import {fs, type ToolJson} from "./context";

export function read(file: string): string {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

export function stripTicks(value: string): string {
  return value.replace(/^`+|`+$/g, "").trim();
}

export function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function asObject(value: unknown): ToolJson {
  return value && typeof value === "object" ? (value as ToolJson) : {};
}

export function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function printPairs(fields: Record<string, string>): void {
  for (const [key, value] of Object.entries(fields)) {
    process.stdout.write(`${key}=${String(value ?? "")}\n`);
  }
}
