#!/usr/bin/env npx tsx

import {runPackageCommand} from "./cli-core";

runPackageCommand("stop-hook-project", process.argv.slice(2));
