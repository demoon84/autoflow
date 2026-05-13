#!/usr/bin/env npx tsx

import {runPackageCommand} from "./cli-core";

runPackageCommand("render-heartbeats", process.argv.slice(2));
