import {fs} from "./context";

// ─── File IO ────────────────────────────────────────────────────────
export function readFileSafe(p: string): string {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

export function writeFileSafe(p: string, content: string): boolean {
  try {
    const tempPath = `${p}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tempPath, content, "utf8");
    fs.renameSync(tempPath, p);
    return true;
  } catch {
    return false;
  }
}
