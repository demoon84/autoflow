#!/usr/bin/env npx tsx

import {runPackageCommand} from "./cli-core";

runPackageCommand("run-role", process.argv.slice(2));
