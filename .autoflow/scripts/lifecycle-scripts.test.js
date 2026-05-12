#!/usr/bin/env node
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { resolveLegacyScript, scriptStem } = require("./lifecycle-script-runner");
const { decideTicketOwnerClaim, parseTicketOwnerLock, workerIdMatchesField } = require("./ticket-owner-lock");

test("scriptStem strips extension", () => {
  assert.equal(scriptStem("/tmp/start-ticket-owner.js"), "start-ticket-owner");
});

test("resolveLegacyScript points to legacy shell file", () => {
  const scriptPath = path.join("/tmp", "finish-ticket-owner.js");
  assert.equal(resolveLegacyScript(scriptPath), path.join("/tmp", "finish-ticket-owner.legacy.sh"));
});

test("parseTicketOwnerLock returns parsed token fields", () => {
  assert.deepEqual(parseTicketOwnerLock("worker:41294:2026-05-10T13:40:18Z"), {
    runnerId: "worker",
    pid: 41294,
    spawnedAt: "2026-05-10T13:40:18Z",
  });
});

test("workerIdMatchesField accepts worker and owner aliases", () => {
  assert.equal(workerIdMatchesField("worker-2", "owner-2"), true);
  assert.equal(workerIdMatchesField("owner", "worker"), true);
  assert.equal(workerIdMatchesField("wiki", "worker"), false);
});

test("decideTicketOwnerClaim blocks a live foreign runner", () => {
  const result = decideTicketOwnerClaim(
    "worker-2:999:2026-05-10T13:40:18Z",
    "worker",
    41294,
    () => true
  );
  assert.equal(result.decision, "blocked_other_runner_alive");
});

test("decideTicketOwnerClaim takes over a stale foreign runner", () => {
  const result = decideTicketOwnerClaim(
    "worker-2:999:2026-05-10T13:40:18Z",
    "worker",
    41294,
    () => false
  );
  assert.equal(result.decision, "takeover_stale_pid");
});

test("decideTicketOwnerClaim takes over same runner with new pid", () => {
  const result = decideTicketOwnerClaim(
    "worker:111:2026-05-10T13:40:18Z",
    "worker",
    41294,
    () => true
  );
  assert.equal(result.decision, "takeover_same_runner");
});

test("decideTicketOwnerClaim understands legacy ownership values", () => {
  assert.equal(decideTicketOwnerClaim("worker", "worker", 41294).decision, "owned_legacy");
  assert.equal(decideTicketOwnerClaim("worker-2", "worker", 41294).decision, "takeover_legacy");
});
