
export function emit(fields: Record<string, string | number | undefined>): void {
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === "") continue;
    process.stdout.write(`${key}=${value}\n`);
  }
}

export function keyValue(raw: string, key: string): string {
  const line = raw.split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1) : "";
}
