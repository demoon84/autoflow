#!/usr/bin/env node
"use strict";

const { runAsMain } = require("./lifecycle-script-runner");

runAsMain(__filename, process.argv.slice(2));
