#!/usr/bin/env npx tsx

import {runPackageCommand} from "./cli-core";

runPackageCommand("coordinator-project", process.argv.slice(2));
