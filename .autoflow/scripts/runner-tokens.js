#!/usr/bin/env node
// e2e-token-test: order_272
// Thin wrapper — delegates to runner-tokens.ts via tsx so agent.md `.js`
// references stay valid while the implementation is TypeScript.
const path = require("node:path");
const fs = require("node:fs");
const cp = require("node:child_process");

const here = __dirname;
const tsFile = path.join(here, "runner-tokens.ts");
const projectRoot = path.resolve(here, "..", "..");
const localTsx = path.join(projectRoot, "node_modules", ".bin", "tsx");
const useLocal = fs.existsSync(localTsx);
const cmd = useLocal ? localTsx : "npx";
const args = useLocal
  ? [tsFile, ...process.argv.slice(2)]
  : ["tsx", tsFile, ...process.argv.slice(2)];
const r = cp.spawnSync(cmd, args, { stdio: "inherit" });
process.exit(r.status == null ? 1 : r.status);
