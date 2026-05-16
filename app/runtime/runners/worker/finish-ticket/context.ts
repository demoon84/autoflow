import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import {execFileSync, spawnSync} from "node:child_process";

export {crypto, fs, path, execFileSync, spawnSync};
export type PairMap = Record<string, string>;

export const scriptDir = path.dirname(path.resolve(process.argv[1] || __filename));
export const boardRoot = path.resolve(process.env.AUTOFLOW_BOARD_ROOT || process.env.BOARD_ROOT || path.join(scriptDir, ".."));
export const projectRoot = path.resolve(process.env.PROJECT_ROOT || process.env.AUTOFLOW_PROJECT_ROOT || path.join(boardRoot, ".."));
export const workerId = process.env.RUNNER_ID || process.env.AUTOFLOW_RUNNER_ID || process.env.AUTOFLOW_WORKER_ID || "worker";
export const timestamp = new Date().toISOString().replace(/.d+Z$/, "Z");
