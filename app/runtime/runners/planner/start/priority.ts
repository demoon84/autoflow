import {utils} from "./context";

export function normalizeChangeType(value: string): string {
  const clean = utils.trimSpaces(value).toLowerCase();
  if (["docs", "cleanup", "infra"].includes(clean)) return clean;
  return "code";
}
