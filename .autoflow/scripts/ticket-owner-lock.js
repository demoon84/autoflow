#!/usr/bin/env node
"use strict";

function parseTicketOwnerLock(raw) {
  const value = String(raw || "").trim();
  const match = value.match(/^(.+):([0-9]+):([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z)$/);
  if (!match) {
    return null;
  }

  return {
    runnerId: match[1],
    pid: Number(match[2]),
    spawnedAt: match[3],
  };
}

function workerIdMatchesField(field, workerId) {
  const normalizeRunnerAlias = (value) => {
    const trimmed = String(value || "").trim();
    if (!trimmed) return "";
    if (trimmed === "worker" || trimmed === "owner") return "runner";
    if (trimmed.startsWith("worker-")) return `runner-${trimmed.slice("worker-".length)}`;
    if (trimmed.startsWith("owner-")) return `runner-${trimmed.slice("owner-".length)}`;
    return trimmed;
  };

  const normalizedField = normalizeRunnerAlias(field);
  const normalizedWorkerId = normalizeRunnerAlias(workerId);
  if (!normalizedField || !normalizedWorkerId) {
    return false;
  }

  return normalizedField === normalizedWorkerId;
}

function decideTicketOwnerClaim(raw, currentRunner, currentPid, pidAlive = () => false) {
  const value = String(raw || "").trim();
  const parsed = parseTicketOwnerLock(value);

  if (!value) {
    return { decision: "unclaimed", runnerId: "", pid: "", spawnedAt: "" };
  }

  if (parsed) {
    if (workerIdMatchesField(parsed.runnerId, currentRunner)) {
      if (String(parsed.pid) === String(currentPid)) {
        return { decision: "owned_same_pid", runnerId: parsed.runnerId, pid: String(parsed.pid), spawnedAt: parsed.spawnedAt };
      }
      return { decision: "takeover_same_runner", runnerId: parsed.runnerId, pid: String(parsed.pid), spawnedAt: parsed.spawnedAt };
    }

    if (pidAlive(Number(parsed.pid))) {
      return { decision: "blocked_other_runner_alive", runnerId: parsed.runnerId, pid: String(parsed.pid), spawnedAt: parsed.spawnedAt };
    }

    return { decision: "takeover_stale_pid", runnerId: parsed.runnerId, pid: String(parsed.pid), spawnedAt: parsed.spawnedAt };
  }

  if (workerIdMatchesField(value, currentRunner)) {
    return { decision: "owned_legacy", runnerId: "", pid: "", spawnedAt: "" };
  }

  return { decision: "takeover_legacy", runnerId: "", pid: "", spawnedAt: "" };
}

module.exports = {
  decideTicketOwnerClaim,
  parseTicketOwnerLock,
  workerIdMatchesField,
};
