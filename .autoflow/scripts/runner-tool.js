#!/usr/bin/env node
// Thin wrapper — delegates to runner-tool.ts via tsx.
const path = require("node:path");
const fs = require("node:fs");
const cp = require("node:child_process");

const here = __dirname;
const tsFile = path.join(here, "runner-tool.ts");
const projectRoot = path.resolve(here, "..", "..");
const localTsx = path.join(projectRoot, "node_modules", ".bin", "tsx");
const useLocal = fs.existsSync(localTsx);
const cmd = useLocal ? localTsx : "npx";
const args = useLocal
  ? [tsFile, ...process.argv.slice(2)]
  : ["tsx", tsFile, ...process.argv.slice(2)];
const r = cp.spawnSync(cmd, args, { stdio: "inherit" });
process.exit(r.status == null ? 1 : r.status);
