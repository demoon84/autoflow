import {fs, path, BOARD_ROOT, requestedNormalized, utils} from "./context";
import {boardRelativePath} from "./ids";
import {collectFiles, listMatchingFiles} from "./files";

export function orderRefIsAlreadyPromoted(orderRef: string): boolean {
  const roots = [
    path.join(BOARD_ROOT, "tickets", "prd"),
    path.join(BOARD_ROOT, "tickets", "done"),
  ];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const files = collectFiles(root, /^(prd|project)_\d+\.md$/);
    for (const file of files) {
      const text = utils.readFileSafe(file);
      if (text.includes(`Source: \`${orderRef}\``) || text.includes(`Source: ${orderRef}`)) return true;
    }
  }
  return false;
}

export function orderFileIsActionable(file: string): boolean {
  if (!fs.existsSync(file)) return false;
  if (orderRefIsAlreadyPromoted(boardRelativePath(file))) return false;
  const status = utils.trimSpaces(utils.extractScalarFieldInSection(file, "Order", "Status")).toLowerCase();
  return !["done", "complete", "completed", "archived", "cancelled", "canceled", "closed"].includes(status);
}

export function orderFileIsRetry(file: string): boolean {
  return /^order_.*_retry_.*\.md$/.test(path.basename(file));
}

export function selectRetryOrder(): string {
  for (const file of listMatchingFiles(path.join(BOARD_ROOT, "tickets", "order"), [/^order_.*_retry_.*\.md$/])) {
    if (orderFileIsRetry(file) && orderFileIsActionable(file)) return file;
  }
  return "";
}

export function selectNonretryOrder(): string {
  if (requestedNormalized) {
    const file = path.join(BOARD_ROOT, "tickets", "order", `order_${requestedNormalized}.md`);
    return orderFileIsActionable(file) && !orderFileIsRetry(file) ? file : "";
  }
  for (const file of listMatchingFiles(path.join(BOARD_ROOT, "tickets", "order"), [/^order_.*\.md$/])) {
    if (!orderFileIsRetry(file) && orderFileIsActionable(file)) return file;
  }
  return "";
}
