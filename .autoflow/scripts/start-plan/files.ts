import {fs, path, BOARD_ROOT} from "./context";
import {extractNumericId} from "./ids";
import {priorityRank} from "./priority";

export function listMatchingFiles(dir: string, patterns: RegExp[]): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => patterns.some((re) => re.test(name)))
    .map((name) => path.join(dir, name))
    .filter((file) => fs.statSync(file).isFile())
    .sort((a, b) => {
      const rank = priorityRank(a) - priorityRank(b);
      if (rank !== 0) return rank;
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
  for (const file of collectFiles(path.join(BOARD_ROOT, "tickets"), /^(Todo-\d\d\d|tickets_\d\d\d|reject_\d\d\d)\.md$/)) {
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
