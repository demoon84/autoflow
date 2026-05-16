import {crypto, fs, path, boardRoot, projectRoot, timestamp} from "./context";
import {appendReplanReason, scalar} from "./ticket-sections";
import {cleanupWorktree, clearActiveState} from "./state";
import {positiveInt, printPairs, read, write} from "./io";

export function routeToOrderRetry(ticketFile: string, ticketId: string, failure: string, replanMessage: string): void {
  const prdKey = scalar(ticketFile, "Ticket", "PRD Key");
  const title = scalar(ticketFile, "Ticket", "Title");
  const priority = scalar(ticketFile, "Ticket", "Priority").toLowerCase();
  const retryPriority = priority === "critical" || priority === "high" ? priority : "high";
  if (replanMessage) appendReplanReason(ticketFile, replanMessage);
  const fpInput = `${prdKey}|${title}|${failure}|${replanMessage}`;
  const fingerprint = crypto.createHash("sha256").update(fpInput).digest("hex").slice(0, 12);
  const orderDir = path.join(boardRoot, "tickets", "order");
  fs.mkdirSync(orderDir, { recursive: true });
  const prior = fs.readdirSync(orderDir)
    .filter((name) => /^order_.*_retry_.*\.md$/.test(name))
    .filter((name) => read(path.join(orderDir, name)).includes(`retry_fingerprint: ${fingerprint}`))
    .length;
  const retryCount = prior + 1;
  const retryMax = positiveInt(process.env.AUTOFLOW_ORDER_RETRY_MAX_FINGERPRINT || process.env.AUTOFLOW_INBOX_RETRY_MAX_FINGERPRINT || "", 3);
  const decision = retryCount >= retryMax ? "needs_user" : "retry";
  const compact = timestamp.replace(/[-:]/g, "");
  const retryFile = path.join(orderDir, `order_${ticketId}_retry_${retryCount}_${compact}.md`);
  const snapshot = read(ticketFile);
  write(retryFile, `# Retry order from replan ticket ${ticketId}

source: retry
retry_count: ${retryCount}
retry_max: ${retryMax}
retry_decision: ${decision}
retry_fingerprint: ${fingerprint}
origin_ticket: ${ticketId}
origin_prd: ${prdKey}
failure_class: ${failure}
replan_at: ${timestamp}

## Order

- Status: order
- Source: retry
- Priority: ${retryPriority}
- Origin Ticket: Todo-${ticketId}
- Origin PRD: ${prdKey}

## Original Title
- ${title}

## Replan Reason
\`\`\`
${replanMessage || "(see ticket replan reason)"}
\`\`\`

## Retry Decision
- ${decision} (retry_count=${retryCount} of retry_max=${retryMax})

## Planner Hint
- This retry came from verifier replan. Treat the follow-up TODO as priority work before unrelated todo items.
- Reuse the original PRD if possible. Adjust Allowed Paths or Done When to avoid the failure class above.

## Original Ticket

\`\`\`\`markdown
${snapshot}
\`\`\`\`
`);

  cleanupWorktree(ticketFile);
  try { fs.unlinkSync(ticketFile); } catch {}
  clearActiveState();
  printPairs({
    status: "replanned",
    outcome: "replan",
    failure_class: failure,
    ticket: "(removed; embedded in order retry)",
    ticket_id: ticketId,
    "wiki.status": "ai_owned",
    commit_status: "not_committed_replan_ticket",
    order_retry_file: retryFile,
    retry_count: String(retryCount),
    retry_decision: decision,
    retry_fingerprint: fingerprint,
    worktree_cleanup: "attempted",
    board_root: boardRoot,
    project_root: projectRoot,
  });
}
