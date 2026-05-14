import {BOARD_ROOT, PROJECT_ROOT} from "./context";
import {checks, errors, warnings} from "./reporter";
import {checkActiveSections, checkDuplicateTicketIds, checkRecoveryStateFields, checkRecoveryStateValues, checkResolvedTicketWorktrees, checkRogueProjectRootBoardPaths, checkTodoWorktreeMetadata} from "./checks";

const args = process.argv.slice(2);
let strict = false;
for (const a of args) {
    if (a === "--strict") strict = true;
    else if (a === "-h" || a === "--help") {
        process.stdout.write("Usage:\n  board-guard.ts [--strict]\n\nValidates Autoflow board invariants after AI-authored markdown changes.\n");
        process.exit(0);
    } else {
        process.stderr.write(`Unknown board-guard argument: ${a}\n`);
        process.exit(2);
    }
}

checkDuplicateTicketIds();
checkTodoWorktreeMetadata();
checkActiveSections();
checkRecoveryStateFields();
checkRecoveryStateValues();
checkResolvedTicketWorktrees();
checkRogueProjectRootBoardPaths();

if (strict && warnings.length > 0) {
    for (const w of warnings) errors.push(`strict mode: ${w}`);
}

let status = "ok";
if (errors.length > 0) status = "error";
else if (warnings.length > 0) status = "warning";

process.stdout.write(`status=${status}\n`);
process.stdout.write(`board_root=${BOARD_ROOT}\n`);
process.stdout.write(`project_root=${PROJECT_ROOT}\n`);
process.stdout.write(`strict=${strict}\n`);
process.stdout.write(`error_count=${errors.length}\n`);
process.stdout.write(`warning_count=${warnings.length}\n`);
for (const c of checks) process.stdout.write(`check.${c.id}=${c.status}\n`);
errors.forEach((e, i) => process.stdout.write(`error.${i + 1}=${e}\n`));
warnings.forEach((w, i) => process.stdout.write(`warning.${i + 1}=${w}\n`));

process.exit(errors.length > 0 ? 1 : 0);
