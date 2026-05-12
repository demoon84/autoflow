#!/usr/bin/env node
// notify-user.ts — send user notifications on needs_user / blocked events.
//
// Usage:
//   node notify-user.ts --event <needs_user|blocked> --ticket <id>
//                       --title "..." --message "..."
//
// Channels (configured via config.toml [[notifications]] or .local/secrets.json):
//   webhook   — HTTP POST JSON to webhook_url
//   osascript — macOS system notification (display notification)
//   slack     — Slack incoming webhook POST
//
// Cooldown: .autoflow/runners/state/notify-cooldown.json
//   Same ticket + event within AUTOFLOW_NOTIFY_COOLDOWN_SEC (default 3600s) is
//   silently skipped. 1원칙: any channel failure is best-effort; never blocks flow.
//
// Env knob: AUTOFLOW_NOTIFY_BLOCKED_THRESHOLD_SEC (default 1800)
//   Used by callers to decide when blocked threshold is reached before calling.
// Env knob: AUTOFLOW_NOTIFY_COOLDOWN_SEC (default 3600)

import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import http from "node:http";
import { execSync } from "node:child_process";
import { URL } from "node:url";

const BOARD_ROOT = process.env.BOARD_ROOT || path.join(process.cwd(), ".autoflow");
const COOLDOWN_SEC = Number(process.env.AUTOFLOW_NOTIFY_COOLDOWN_SEC ?? "3600");

interface NotifyChannel {
  type: "webhook" | "osascript" | "slack";
  webhook_url?: string;
  enabled?: boolean;
}

interface CooldownEntry {
  last_sent: number; // epoch ms
}

type CooldownMap = Record<string, CooldownEntry>; // key: ticketId|event

function parseArgs(): { event: string; ticket: string; title: string; message: string } {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] ?? "" : "";
  };
  return {
    event: get("--event") || "notify",
    ticket: get("--ticket") || "unknown",
    title: get("--title") || "Autoflow notification",
    message: get("--message") || "",
  };
}

function loadConfig(): NotifyChannel[] {
  const channels: NotifyChannel[] = [];

  // Load from .local/secrets.json (gitignored, user-maintained)
  const secretsPath = path.join(BOARD_ROOT, ".local", "secrets.json");
  if (fs.existsSync(secretsPath)) {
    try {
      const secrets = JSON.parse(fs.readFileSync(secretsPath, "utf8"));
      for (const ch of secrets.notifications ?? []) {
        channels.push(ch as NotifyChannel);
      }
    } catch {}
  }

  // Load from config.toml [[notifications]] blocks (basic TOML parse)
  const configPath = path.join(BOARD_ROOT, "runners", "config.toml");
  if (fs.existsSync(configPath)) {
    try {
      const raw = fs.readFileSync(configPath, "utf8");
      const blocks = raw.split(/^\[\[notifications\]\]/m).slice(1);
      for (const block of blocks) {
        const section = block.split(/^\[/m)[0];
        const ch: Record<string, string> = {};
        for (const line of section.split("\n")) {
          const m = line.match(/^\s*(\w+)\s*=\s*"([^"]*)"/);
          if (m) ch[m[1]] = m[2];
        }
        if (ch.type) channels.push(ch as unknown as NotifyChannel);
      }
    } catch {}
  }

  return channels;
}

function cooldownKey(ticket: string, event: string): string {
  return `${ticket}|${event}`;
}

function checkAndUpdateCooldown(ticket: string, event: string): boolean {
  const cooldownPath = path.join(BOARD_ROOT, "runners", "state", "notify-cooldown.json");
  let map: CooldownMap = {};
  try {
    map = JSON.parse(fs.readFileSync(cooldownPath, "utf8"));
  } catch {}

  const key = cooldownKey(ticket, event);
  const now = Date.now();
  const entry = map[key];
  if (entry && now - entry.last_sent < COOLDOWN_SEC * 1000) {
    return false; // still in cooldown
  }

  map[key] = { last_sent: now };
  try {
    fs.mkdirSync(path.dirname(cooldownPath), { recursive: true });
    fs.writeFileSync(cooldownPath, JSON.stringify(map, null, 2), "utf8");
  } catch {}
  return true;
}

function httpPost(rawUrl: string, body: string): void {
  return new Promise<void>((resolve) => {
    try {
      const u = new URL(rawUrl);
      const mod = u.protocol === "https:" ? https : http;
      const req = mod.request(
        { hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: "POST",
          headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } },
        (res) => { res.resume(); res.on("end", resolve); }
      );
      req.on("error", () => resolve());
      req.setTimeout(5000, () => { req.destroy(); resolve(); });
      req.write(body);
      req.end();
    } catch { resolve(); }
  }) as unknown as void;
}

async function sendWebhook(ch: NotifyChannel, title: string, message: string): Promise<void> {
  if (!ch.webhook_url) return;
  const body = JSON.stringify({ title, message, text: `${title}\n${message}` });
  await (httpPost(ch.webhook_url, body) as unknown as Promise<void>);
}

async function sendSlack(ch: NotifyChannel, title: string, message: string): Promise<void> {
  if (!ch.webhook_url) return;
  const body = JSON.stringify({ text: `*${title}*\n${message}` });
  await (httpPost(ch.webhook_url, body) as unknown as Promise<void>);
}

function sendOsascript(title: string, message: string): void {
  if (process.platform !== "darwin") return;
  try {
    const safe = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').slice(0, 200);
    execSync(
      `osascript -e 'display notification "${safe(message)}" with title "${safe(title)}"'`,
      { timeout: 5000, stdio: "ignore" }
    );
  } catch {}
}

async function main(): Promise<void> {
  const { event, ticket, title, message } = parseArgs();

  if (!checkAndUpdateCooldown(ticket, event)) {
    process.stdout.write(`notify_status=cooldown ticket=${ticket} event=${event}\n`);
    process.exit(0);
  }

  const channels = loadConfig();
  if (channels.length === 0) {
    process.stdout.write(`notify_status=no_config ticket=${ticket} event=${event}\n`);
    process.exit(0);
  }

  let sent = 0;
  for (const ch of channels) {
    if (ch.enabled === false) continue;
    try {
      if (ch.type === "webhook") { await sendWebhook(ch, title, message); sent++; }
      else if (ch.type === "slack") { await sendSlack(ch, title, message); sent++; }
      else if (ch.type === "osascript") { sendOsascript(title, message); sent++; }
    } catch {}
  }

  process.stdout.write(`notify_status=sent channels=${sent} ticket=${ticket} event=${event}\n`);
}

main().catch(() => process.exit(0));
