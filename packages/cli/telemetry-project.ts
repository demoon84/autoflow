#!/usr/bin/env npx tsx

import {runPackageCommand} from "./cli-core";

runPackageCommand("telemetry-project", process.argv.slice(2));
