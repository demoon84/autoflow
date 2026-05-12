#!/usr/bin/env node
"use strict";

require("./tsx-script-runner").runTsSibling(__filename, process.argv.slice(2));
