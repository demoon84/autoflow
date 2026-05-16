import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("tsx/cjs");
const nodePtyPermissions = require("../src/main/node-pty-permissions.ts");

const { fixNodePtySpawnHelperPermissions } = nodePtyPermissions;

fixNodePtySpawnHelperPermissions({
  log: (message) => console.log(`[desktop postinstall] ${message}`)
});
