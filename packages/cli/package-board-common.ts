#!/usr/bin/env npx tsx

import {runPackageCommand} from "./cli-core";

runPackageCommand("package-board-common", process.argv.slice(2));
