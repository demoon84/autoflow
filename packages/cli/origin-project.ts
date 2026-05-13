#!/usr/bin/env npx tsx

import {runPackageCommand} from "./cli-core";

runPackageCommand("origin-project", process.argv.slice(2));
