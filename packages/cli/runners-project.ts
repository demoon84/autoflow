#!/usr/bin/env npx tsx

import {runPackageCommand} from "./cli-core";

runPackageCommand("runners-project", process.argv.slice(2));
