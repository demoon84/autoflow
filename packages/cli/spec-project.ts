#!/usr/bin/env npx tsx

import {runPackageCommand} from "./cli-core";

runPackageCommand("spec-project", process.argv.slice(2));
