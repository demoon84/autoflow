#!/usr/bin/env npx tsx

import {runPackageCommand} from "./cli-core";

runPackageCommand("metrics-project", process.argv.slice(2));
