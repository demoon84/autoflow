#!/usr/bin/env npx tsx

import {runPackageCommand} from "./cli-core";

runPackageCommand("status-project", process.argv.slice(2));
