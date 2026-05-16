import * as fs from "node:fs";
import * as path from "node:path";
import {spawnSync} from "node:child_process";
import * as utils from "../../../shared/board-utils";

export {fs, path, spawnSync, utils};

export const SCRIPT_DIR = path.dirname(path.resolve(process.argv[1] || __filename));
export const BOARD_ROOT = utils.resolveBoardRoot();
export const PROJECT_ROOT = utils.resolveProjectRoot();
export const requestedArg = process.argv[2] ?? "";
export const requestedNormalized = requestedArg.replace(/^.*_/, "").replace(/\.md$/i, "").replace(/\D/g, "")
  ? String(Number.parseInt(requestedArg.replace(/^.*_/, "").replace(/\.md$/i, "").replace(/\D/g, ""), 10)).padStart(3, "0")
  : "";
export const workerId = process.env.AUTOFLOW_WORKER_ID || process.env.WORKER_ID || "planner";
export const displayId = /^(planner|plan)-/.test(workerId) || workerId === "planner" || workerId === "plan" ? "planner" : workerId || "planner";

export type PlannerSource =
  | "express-order-to-todo"
  | "prd-to-todo"
  | "order-retry"
  | "order"
  | "legacy-plan"
  | "vague-done-when"
  | "needs-user-secret";
