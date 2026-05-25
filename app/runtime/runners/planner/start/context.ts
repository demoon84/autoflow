import * as fs from "node:fs";
import * as path from "node:path";
import {spawnSync} from "node:child_process";
import * as utils from "../../../shared/board-utils";

export {fs, path, spawnSync, utils};

export const SCRIPT_DIR = path.dirname(path.resolve(process.argv[1] || __filename));
export const BOARD_ROOT = utils.resolveBoardRoot();
export const PROJECT_ROOT = utils.resolveProjectRoot();
export const requestedArg = process.argv[2] ?? "";
export const requestedNormalized = normalizeRequestedId(requestedArg);
export const workerId = process.env.AUTOFLOW_WORKER_ID || process.env.WORKER_ID || "planner";
export const displayId = /^(planner|plan)-/.test(workerId) || workerId === "planner" || workerId === "plan" ? "planner" : workerId || "planner";

function normalizeRequestedId(raw: string): string {
  const base = path.basename(String(raw || "")).replace(/\.md$/i, "").replace(/^PRD-/i, "");
  const scoped = base.match(/^([A-Za-z0-9][A-Za-z0-9_.-]*)-(\d+)$/);
  if (scoped) return `${scoped[1].toLowerCase()}-${scoped[2].padStart(3, "0")}`;
  const numeric = base.match(/(\d+)/);
  return numeric ? String(Number.parseInt(numeric[1], 10)).padStart(3, "0") : "";
}

export type PlannerSource =
  | "prd-to-todo"
  | "legacy-plan"
  | "vague-done-when"
  | "needs-user-secret";
