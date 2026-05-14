import * as fs from "node:fs";
import * as path from "node:path";
import {execFileSync} from "node:child_process";
import * as utils from "../board-utils";

export {fs, path, execFileSync, utils};
export const BOARD_ROOT = utils.resolveBoardRoot();
export const PROJECT_ROOT = utils.resolveProjectRoot();
export const TICKETS_ROOT = path.join(BOARD_ROOT, "tickets");
