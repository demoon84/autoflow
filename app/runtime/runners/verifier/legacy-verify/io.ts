import {fs, path} from "./context";

export function positiveInt(raw: string, fallback: number): number {
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function read(file: string): string {
  try { return fs.readFileSync(file, "utf8"); } catch { return ""; }
}

export function write(file: string, content: string): void {
  fs.writeFileSync(file, content.endsWith("\n") ? content : `${content}\n`, "utf8");
}

export function nowIso(): string {
  return new Date().toISOString().replace(/\.\d+Z$/, "Z");
}

export function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function printPairs(fields: Record<string, string>): void {
  for (const [key, value] of Object.entries(fields)) process.stdout.write(`${key}=${value ?? ""}\n`);
}
