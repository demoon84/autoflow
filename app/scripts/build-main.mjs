import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outdir = path.join(appRoot, "dist", "main");

const common = {
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  packages: "external",
  sourcemap: true,
  logLevel: "silent"
};

export async function buildMainProcess() {
  await Promise.all([
    build({
      ...common,
      entryPoints: [path.join(appRoot, "src", "main.ts")],
      outfile: path.join(outdir, "main.cjs")
    }),
    build({
      ...common,
      entryPoints: [path.join(appRoot, "src", "preload.ts")],
      outfile: path.join(outdir, "preload.cjs")
    })
  ]);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  buildMainProcess().catch((error) => {
    process.exit(1);
  });
}
