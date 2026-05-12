import nodePtyPermissions from "../src/main/node-pty-permissions.js";

const { fixNodePtySpawnHelperPermissions } = nodePtyPermissions;

fixNodePtySpawnHelperPermissions({
  log: (message) => console.log(`[desktop postinstall] ${message}`)
});
