#!/usr/bin/env tsx
/*
 * runner-tool.ts — stable CLI entrypoint for LLM-called runner tools.
 *
 * Command implementations live under ./runner-tool/<role>/<command>.ts so each
 * file owns one narrow feature while this file preserves the installed contract.
 */

import { main } from "./runner-tool/index";

main();
