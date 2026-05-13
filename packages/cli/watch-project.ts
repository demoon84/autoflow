#!/usr/bin/env npx tsx

import {runPackageCommand} from "./cli-core";

runPackageCommand("watch-project", process.argv.slice(2));
