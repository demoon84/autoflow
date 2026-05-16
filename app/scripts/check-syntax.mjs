import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = [
  "src/main.js",
  "src/preload.js"
];

let failed = false;
for (const file of files) {
  const absolute = path.join(root, file);
  const result = spawnSync(process.execPath, ["--check", absolute], {
    stdio: "inherit"
  });

  if (result.status !== 0) {
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}
