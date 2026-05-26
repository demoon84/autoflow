import type {JsonObject} from "./context";
import {
    BOARD_ROOT,
    PROJECT_ROOT,
    TICKETS_ROOT,
    SCRIPT_DIR,
    currentRunnerId,
    fail,
    fs,
    getArg,
    normalizeId,
    path,
    resolveBoardPath,
    safeIsFile,
    spawnOutputText,
    spawnTsScript,
    boardRel,
    utils,
} from "./context";

export type AssignmentStatus = "leased" | "running" | "completed" | "failed" | "blocked" | "released" | "expired";

export interface AssignmentRecord {
    runner_id: string;
    role: string;
    assignment_id: string;
    lease_version: number;
    assigned_item_ref: string;
    status: AssignmentStatus;
    contract_id: string;
    contract_digest: string;
    contract_summary: string;
    contract_refs: string[];
    created_at: string;
    updated_at: string;
    started_at: string;
    completed_at: string;
    expires_at: string;
    result: string;
    reason: string;
}

export interface AssignmentCheck {
    ok: boolean;
    reason: string;
    runner_id: string;
    assignment: AssignmentRecord | null;
}

const activeAssignmentStatuses = new Set<AssignmentStatus>(["leased", "running"]);
const fixedRunnerRoles = new Set(["planner", "worker", "wiki"]);

function assignmentSafeSegment(raw: string): string {
    return String(raw || "").trim().replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

function assignmentStateRoot(): string {
    return path.join(BOARD_ROOT, "automations", "state", "assignments");
}

function assignmentPath(runnerId: string): string {
    return path.join(assignmentStateRoot(), `${assignmentSafeSegment(runnerId)}.json`);
}

export function currentAssignmentRunnerId(fallbackRole = "runner"): string {
    return assignmentSafeSegment(
        getArg("--runner") ||
        process.env.AUTOFLOW_RUNNER_ID ||
        process.env.RUNNER_ID ||
        currentRunnerId(fallbackRole)
    );
}

function normalizeAssignmentRole(role: string): string {
    const value = String(role || "").trim().toLowerCase();
    if (value === "plan") return "planner";
    if (value === "verify") return "verifier";
    if (value === "wiki-maintainer") return "wiki";
    return value;
}

function runnerIdForRole(role: string): string {
    const normalized = normalizeAssignmentRole(role);
    if (normalized === "wiki-maintainer") return "wiki";
    return fixedRunnerRoles.has(normalized) ? normalized : normalized || "runner";
}

function fixedRunnerModeAllowsMissingAssignment(role: string, runnerId: string): boolean {
    if (/^(1|true|yes|on)$/i.test(process.env.AUTOFLOW_REQUIRE_RUNNER_ASSIGNMENT || "")) return false;
    const normalizedRole = normalizeAssignmentRole(role);
    const normalizedRunner = assignmentSafeSegment(runnerId).toLowerCase();
    return fixedRunnerRoles.has(normalizedRole) && normalizedRunner === runnerIdForRole(normalizedRole);
}

function recordRunnerId(record: AssignmentRecord): string {
    return assignmentSafeSegment(record.runner_id);
}

function syntheticAssignment(role: string, item: string, runnerId: string): AssignmentRecord {
    const now = utils.nowIso();
    const normalizedRole = normalizeAssignmentRole(role);
    const normalizedRunner = assignmentSafeSegment(runnerId || runnerIdForRole(normalizedRole));
    return {
        runner_id: normalizedRunner,
        role: normalizedRole,
        assignment_id: `fixed-runner-${normalizedRunner}`,
        lease_version: 0,
        assigned_item_ref: item,
        status: "running",
        contract_id: "fixed-runner-v1",
        contract_digest: "",
        contract_summary: `${normalizedRole} fixed runner assignment`,
        contract_refs: [],
        created_at: now,
        updated_at: now,
        started_at: now,
        completed_at: "",
        expires_at: "",
        result: "",
        reason: "fixed_runner_no_assignment",
    };
}

function assignmentIsSynthetic(record: AssignmentRecord): boolean {
    return String(record.assignment_id || "").startsWith("fixed-runner-");
}

function readAssignmentForRunner(runnerId: string, role: string): AssignmentRecord | null {
    const safeRunner = assignmentSafeSegment(runnerId || runnerIdForRole(role));
    if (!safeRunner) return null;
    try {
        const parsed = JSON.parse(fs.readFileSync(assignmentPath(safeRunner), "utf8")) as AssignmentRecord;
        return parsed && parsed.runner_id ? {...parsed, role: normalizeAssignmentRole(parsed.role)} : null;
    } catch {
        return null;
    }
}

const workItemFilenamePattern = /^TODO-(?:[A-Za-z0-9][A-Za-z0-9_.-]*-)?\d+\.md$/i;

function collectWorkerAssignmentItems(root: string, recursive = false): string[] {
    const out: string[] = [];
    const visit = (dir: string): void => {
        let entries: fs.Dirent[] = [];
        try {
            entries = fs.readdirSync(dir, {withFileTypes: true});
        } catch {
            return;
        }
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (recursive) visit(full);
                continue;
            }
            if (entry.isFile() && workItemFilenamePattern.test(entry.name)) out.push(full);
        }
    };
    visit(root);
    return out.sort((left, right) => left.localeCompare(right));
}

function workerAssignmentMatchesQueue(record: AssignmentRecord, queue: "todo" | "inprogress" | "verifier" | "done"): boolean {
    const root = path.join(TICKETS_ROOT, queue);
    const recursive = queue === "done";
    return collectWorkerAssignmentItems(root, recursive).some((candidate) => assignmentMatchesItem(record, candidate));
}

function workerAssignmentHasOpenItem(record: AssignmentRecord): boolean {
    return workerAssignmentMatchesQueue(record, "todo") ||
        workerAssignmentMatchesQueue(record, "inprogress") ||
        workerAssignmentMatchesQueue(record, "verifier");
}

function completeStaleWorkerAssignment(record: AssignmentRecord): AssignmentRecord {
    if (normalizeAssignmentRole(record.role) !== "worker") return record;
    if (!activeAssignmentStatuses.has(record.status)) return record;
    if (!record.assigned_item_ref || workerAssignmentHasOpenItem(record)) return record;
    const done = workerAssignmentMatchesQueue(record, "done");
    return completeRoleAssignment(
        record,
        done
            ? `worker assignment item already completed: ${record.assigned_item_ref}`
            : `worker assignment item is no longer active: ${record.assigned_item_ref}`,
        done ? "completed" : "released"
    );
}

function assignmentLifecycleEnv(): NodeJS.ProcessEnv {
    return {
        ...process.env,
        PROJECT_ROOT,
        AUTOFLOW_PROJECT_ROOT: PROJECT_ROOT,
        BOARD_ROOT,
        AUTOFLOW_BOARD_ROOT: BOARD_ROOT,
    };
}

function parseAssignmentPayload(stdout: string): AssignmentRecord | null {
    try {
        const parsed = JSON.parse(stdout) as JsonObject;
        const assignment = parsed.assignment as AssignmentRecord | undefined;
        return assignment && assignment.runner_id ? assignment : null;
    } catch {
        return null;
    }
}

function runAssignmentLifecycleCommand(
    command: "start" | "complete",
    record: AssignmentRecord,
    extraArgs: string[] = []
): AssignmentRecord {
    const script = path.join(SCRIPT_DIR, "..", "system", "assignment.ts");
    const commonArgs = [
        command,
        "--runner",
        recordRunnerId(record),
        "--assignment",
        record.assignment_id,
        "--lease-version",
        String(record.lease_version),
        ...extraArgs,
    ];
    const result = spawnTsScript(script, commonArgs, assignmentLifecycleEnv());
    const status = typeof result.status === "number" ? result.status : 1;
    const stdout = spawnOutputText(result.stdout).trim();
    const stderr = spawnOutputText(result.stderr).trim();
    if (status !== 0) {
        fail(1, `assignment ${command} failed`, {
            runner_id: recordRunnerId(record),
            assignment_id: record.assignment_id,
            lease_version: record.lease_version,
            exit_status: status,
            stdout,
            stderr,
        });
    }
    return parseAssignmentPayload(stdout) || readAssignmentForRunner(recordRunnerId(record), record.role) || record;
}

export function startAssignmentIfLeased(record: AssignmentRecord): AssignmentRecord {
    if (assignmentIsSynthetic(record)) return record;
    if (record.status !== "leased") return record;
    return runAssignmentLifecycleCommand("start", record);
}

export function completeRoleAssignment(
    record: AssignmentRecord,
    result: string,
    status: Extract<AssignmentStatus, "completed" | "failed" | "blocked" | "released"> = "completed"
): AssignmentRecord {
    if (assignmentIsSynthetic(record)) return record;
    if (!activeAssignmentStatuses.has(record.status)) return record;
    const args = ["--status", status];
    if (result) args.push("--result", result);
    return runAssignmentLifecycleCommand("complete", record, args);
}

export function compactAssignment(record: AssignmentRecord | null): JsonObject | null {
    if (!record) return null;
    return {
        runner_id: recordRunnerId(record),
        role: record.role,
        assignment_id: record.assignment_id,
        lease_version: record.lease_version,
        assigned_item_ref: record.assigned_item_ref,
        status: record.status,
        contract_id: record.contract_id,
        contract_digest: record.contract_digest,
        contract_summary: record.contract_summary,
        contract_refs: record.contract_refs,
        assignment_path: assignmentIsSynthetic(record) ? "" : boardRel(assignmentPath(recordRunnerId(record))),
    };
}

function normalizeRef(raw: string): string {
    return String(raw || "")
        .trim()
        .replace(/^`+|`+$/g, "")
        .replace(/\\/g, "/")
        .replace(/^\.\//, "")
        .replace(/^\.autoflow\//, "")
        .replace(/^\/+/, "")
        .replace(/\/+$/, "")
        .toLowerCase();
}

function refVariants(raw: string): Set<string> {
    const variants = new Set<string>();
    const clean = String(raw || "").trim();
    if (!clean) return variants;
    variants.add(normalizeRef(clean));
    const resolved = resolveBoardPath(clean);
    if (resolved) {
        variants.add(normalizeRef(boardRel(resolved)));
        variants.add(normalizeRef(path.basename(resolved)));
    } else {
        variants.add(normalizeRef(path.basename(clean)));
    }
    return variants;
}

function workItemIdFromText(raw: string): string {
    const match = String(raw || "").match(/\b(?:TODO|WORK)-((?:[A-Za-z0-9][A-Za-z0-9_.-]*-)?\d+)\b/i);
    if (match) return normalizeId(`TODO-${match[1]}`);
    return "";
}

function idFromRef(raw: string): string {
    const clean = String(raw || "").trim();
    const resolved = resolveBoardPath(clean);
    if (resolved && safeIsFile(resolved)) return workItemIdFromText(path.basename(resolved)) || normalizeId(path.basename(resolved));
    return workItemIdFromText(clean) || normalizeId(clean) || workItemIdFromText(path.basename(clean)) || normalizeId(path.basename(clean));
}

export function assignmentMatchesItem(record: AssignmentRecord | null, candidate: string): boolean {
    if (!record || !candidate) return false;
    const assigned = record.assigned_item_ref || "";
    const assignedVariants = refVariants(assigned);
    const candidateVariants = refVariants(candidate);
    for (const value of candidateVariants) {
        if (assignedVariants.has(value)) return true;
    }
    const assignedId = idFromRef(assigned);
    const candidateId = idFromRef(candidate);
    return Boolean(assignedId && candidateId && assignedId === candidateId);
}

export function readRoleAssignment(role: string, fallbackRunnerId = ""): AssignmentCheck {
    const normalizedRole = normalizeAssignmentRole(role);
    const runnerId = currentAssignmentRunnerId(fallbackRunnerId || runnerIdForRole(normalizedRole));
    if (!runnerId) return {ok: false, reason: "assignment_runner_required", runner_id: "", assignment: null};
    let record = readAssignmentForRunner(runnerId, normalizedRole);
    if (!record) {
        if (fixedRunnerModeAllowsMissingAssignment(normalizedRole, runnerId)) {
            return {ok: true, reason: "fixed_runner_no_assignment", runner_id: runnerId, assignment: null};
        }
        return {ok: false, reason: "assignment_required", runner_id: runnerId, assignment: null};
    }
    if (normalizeAssignmentRole(record.role) !== normalizedRole) {
        return {ok: false, reason: "assignment_role_mismatch", runner_id: runnerId, assignment: record};
    }
    record = completeStaleWorkerAssignment(record);
    if (!activeAssignmentStatuses.has(record.status)) {
        if (fixedRunnerModeAllowsMissingAssignment(normalizedRole, runnerId)) {
            return {ok: true, reason: "fixed_runner_no_assignment", runner_id: runnerId, assignment: null};
        }
        return {ok: false, reason: "assignment_not_active", runner_id: runnerId, assignment: record};
    }
    return {ok: true, reason: "", runner_id: runnerId, assignment: record};
}

export function requireRoleAssignmentForItem(role: string, candidate: string, fallbackRunnerId = ""): AssignmentRecord {
    const check = readRoleAssignment(role, fallbackRunnerId);
    if (!check.ok) {
        fail(1, "runner assignment is required before executing this tool", {
            reason: check.reason,
            role,
            runner_id: check.runner_id,
            assignment: compactAssignment(check.assignment),
            assigned_item_ref: check.assignment?.assigned_item_ref || "",
            candidate_item_ref: candidate,
        });
    }
    const assignment = check.assignment || syntheticAssignment(role, candidate, check.runner_id);
    if (!assignment || !assignmentMatchesItem(assignment, candidate)) {
        fail(1, "runner assignment does not match requested work item", {
            reason: "assignment_item_mismatch",
            role,
            runner_id: check.runner_id,
            assignment: compactAssignment(assignment),
            assigned_item_ref: assignment?.assigned_item_ref || "",
            candidate_item_ref: candidate,
        });
    }
    return assignment;
}

export function requireRoleAssignment(role: string, fallbackRunnerId = ""): AssignmentRecord {
    const check = readRoleAssignment(role, fallbackRunnerId);
    if (!check.ok) {
        fail(1, "runner assignment is required before executing this tool", {
            reason: check.reason,
            role,
            runner_id: check.runner_id,
            assignment: compactAssignment(check.assignment),
            assigned_item_ref: check.assignment?.assigned_item_ref || "",
        });
    }
    return (check.assignment || syntheticAssignment(role, "", check.runner_id)) as AssignmentRecord;
}
