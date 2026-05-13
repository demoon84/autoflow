#!/usr/bin/env npx tsx

import {runPackageCommand} from "./cli-core";

runPackageCommand("cli-common", process.argv.slice(2));
