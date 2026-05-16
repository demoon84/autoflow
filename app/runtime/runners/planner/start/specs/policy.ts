import {fs, path, BOARD_ROOT} from "../context";
import {priorityRank} from "../priority";

export function choosePolicyPick(orderFile: string, specFile: string): "order" | "spec" | "" {
  if (!orderFile && !specFile) return "";
  if (!orderFile) return "spec";
  if (!specFile) return "order";
  const orderRank = priorityRank(orderFile);
  const specRank = priorityRank(specFile);
  if (orderRank < specRank) return "order";
  if (specRank < orderRank) return "spec";
  return prdFirstStuckCheckAndBump(specFile) ? "order" : "spec";
}

export function prdFirstStatePath(): string {
  return path.join(BOARD_ROOT, "runners", "state", "prd-first-stuck.json");
}

export function prdFirstStuckCheckAndBump(specFile: string): boolean {
  const limitRaw = Number.parseInt(process.env.AUTOFLOW_PRD_FIRST_STUCK_LIMIT || process.env.AUTOFLOW_BACKLOG_FIRST_STUCK_LIMIT || "3", 10);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 3;
  const stateFile = prdFirstStatePath();
  const key = path.basename(specFile);
  let state: Record<string, number> = {};
  try {
    state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  } catch {}
  const count = (Number(state[key]) || 0) + 1;
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  if (count >= limit) {
    delete state[key];
    fs.writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    return true;
  }
  state[key] = count;
  fs.writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  return false;
}
