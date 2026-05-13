#!/usr/bin/env npx tsx

import {runPackageCommand} from "./cli-core";

runPackageCommand("cleanup-runner-logs", process.argv.slice(2));
