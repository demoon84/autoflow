import {positiveInt} from "./io";

export function formatOutput(output: string, exitCode: number): string {
  const clean = output.replace(/\r/g, "").trim();
  if (!clean) return "";
  const lines = clean.split("\n");
  const max = exitCode === 0 ? positiveInt(process.env.AUTOFLOW_VERIFY_PASS_OUTPUT_LINES || "", 40) : positiveInt(process.env.AUTOFLOW_VERIFY_FAIL_OUTPUT_LINES || process.env.AUTOFLOW_VERIFY_OUTPUT_LINES || "", 200);
  if (lines.length <= max) return clean;
  const first = Math.max(1, Math.floor(max / 2));
  const last = Math.max(1, max - first);
  return [
    ...lines.slice(0, first),
    `[... truncated: ${lines.length - first - last} lines omitted between first ${first} and last ${last} lines ...]`,
    ...lines.slice(-last),
  ].join("\n");
}
