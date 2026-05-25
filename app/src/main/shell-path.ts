import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";

export function shellQuote(value: unknown): string {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

export function shellScriptSingleQuote(value: unknown): string {
  return shellQuote(value);
}

export function uniquePathEntries(entries: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of entries) {
    const value = String(entry || "").trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

export function existingDirEntries(entries: string[]): string[] {
  return entries.filter((entry) => {
    try {
      return Boolean(entry) && fsSync.existsSync(entry) && fsSync.statSync(entry).isDirectory();
    } catch {
      return false;
    }
  });
}

export function nvmNodeBinEntries(homeDir: string): string[] {
  const versionsRoot = path.join(homeDir, ".nvm", "versions", "node");
  try {
    return fsSync
      .readdirSync(versionsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(versionsRoot, entry.name, "bin"));
  } catch {
    return [];
  }
}

export function augmentedPathValue(basePath: string = process.env.PATH || ""): string {
  const homeDir = os.homedir();
  const baseEntries = String(basePath || "").split(path.delimiter).filter(Boolean);
  const candidateEntries = [
    ...baseEntries,
    ...nvmNodeBinEntries(homeDir),
    path.join(homeDir, ".local", "bin"),
    path.join(homeDir, ".npm-global", "bin"),
    path.join(homeDir, ".npm", "bin"),
    path.join(homeDir, ".yarn", "bin"),
    path.join(homeDir, ".config", "yarn", "global", "node_modules", ".bin"),
    path.join(homeDir, ".bun", "bin"),
    path.join(homeDir, ".volta", "bin"),
    path.join(homeDir, "Library", "pnpm"),
    path.join(homeDir, ".local", "share", "pnpm"),
    path.join(homeDir, ".local", "share", "mise", "shims"),
    path.join(homeDir, ".asdf", "shims"),
    "/opt/homebrew/bin",
    "/opt/homebrew/sbin",
    "/usr/local/bin",
    "/usr/bin",
    "/bin",
    "/usr/sbin",
    "/sbin"
  ];
  return uniquePathEntries(existingDirEntries(candidateEntries)).join(path.delimiter);
}

export function pathWithPrependedEntries(entries: string[], basePath: string = process.env.PATH || ""): string {
  const baseEntries = String(basePath || "").split(path.delimiter).filter(Boolean);
  return uniquePathEntries(existingDirEntries([...entries, ...baseEntries])).join(path.delimiter);
}

export function executableOnPath(command: string, env: NodeJS.ProcessEnv = process.env): string {
  const value = String(command || "").trim();
  if (!value) return "";
  const candidates = value.includes("/") || value.includes("\\")
    ? [value]
    : String(env.PATH || "").split(path.delimiter).filter(Boolean).map((dir) => path.join(dir, value));
  for (const candidate of candidates) {
    try {
      fsSync.accessSync(candidate, fsSync.constants.X_OK);
      return candidate;
    } catch {}
  }
  return "";
}

export function userLoginShell(): string {
  if (process.env.SHELL) return process.env.SHELL;
  try {
    return os.userInfo().shell || "/bin/zsh";
  } catch {
    return "/bin/zsh";
  }
}

export function loginShellCommandArgs(shellPath: string, command: string): string[] {
  const shellName = path.basename(String(shellPath || ""));
  if (["bash", "zsh", "fish"].includes(shellName)) {
    return ["-lic", command];
  }
  return ["-lc", command];
}

export function autoflowShellCommand(args: string[]): string {
  return [`"$AUTOFLOW_CLI"`, ...args.map((arg) => shellQuote(arg))].join(" ");
}
