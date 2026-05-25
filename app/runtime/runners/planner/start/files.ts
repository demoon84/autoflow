import {fs, path, BOARD_ROOT} from "./context";
import {extractNumericId} from "./ids";

function migrateLegacyQueueDir(fromName: string, toName: string): void {
  const ticketsRoot = path.join(BOARD_ROOT, "tickets");
  const fromDir = path.join(ticketsRoot, fromName);
  const toDir = path.join(ticketsRoot, toName);
  if (!fs.existsSync(fromDir)) return;
  fs.mkdirSync(toDir, { recursive: true });
  for (const name of fs.readdirSync(fromDir)) {
    const from = path.join(fromDir, name);
    const to = path.join(toDir, name);
    if (!fs.statSync(from).isFile()) continue;
    if (fs.existsSync(to)) {
      if (name === ".gitkeep") fs.rmSync(from, { force: true });
      continue;
    }
    fs.renameSync(from, to);
  }
  try {
    fs.rmdirSync(fromDir);
  } catch {
    // Leave unresolved legacy conflicts visible rather than deleting evidence.
  }
}

export function migrateLegacyQueueDirs(): void {
  migrateLegacyQueueDir("backlog", "prd");
}

export function listMatchingFiles(dir: string, patterns: RegExp[]): string[] {
  const normalized = dir.split(path.sep).join("/");
  if (normalized.endsWith("/tickets/prd")) {
    migrateLegacyQueueDirs();
  }
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => patterns.some((re) => re.test(name)))
    .map((name) => path.join(dir, name))
    .filter((file) => fs.statSync(file).isFile())
    .sort((a, b) => {
      const id = Number.parseInt(extractNumericId(a) || "999999", 10) - Number.parseInt(extractNumericId(b) || "999999", 10);
      if (id !== 0) return id;
      return a.localeCompare(b);
    });
}

export function collectFiles(root: string, basenameRe: RegExp): string[] {
  if (!fs.existsSync(root)) return [];
  const out: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    for (const name of fs.readdirSync(dir)) {
      const file = path.join(dir, name);
      const stat = fs.statSync(file);
      if (stat.isDirectory()) stack.push(file);
      else if (basenameRe.test(name)) out.push(file);
    }
  }
  return out.sort();
}

export function nextTicketId(): string {
  let max = 0;
  for (const file of collectFiles(path.join(BOARD_ROOT, "tickets"), /^TODO-(?:[A-Za-z0-9][A-Za-z0-9_.-]*-)?\d+\.md$/)) {
    const id = Number.parseInt(extractNumericId(file) || "0", 10);
    if (id > max) max = id;
  }
  return String(max + 1).padStart(3, "0");
}

export function archiveFile(source: string, target: string): void {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.existsSync(target)) fs.rmSync(target);
  fs.renameSync(source, target);
}

export function filesEqual(a: string, b: string): boolean {
  try {
    return fs.readFileSync(a).equals(fs.readFileSync(b));
  } catch {
    return false;
  }
}
