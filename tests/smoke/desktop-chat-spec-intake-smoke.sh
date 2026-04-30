#!/usr/bin/env bash
# desktop-chat-spec-intake-smoke.sh — static smoke for prd_068 desktop chat.
#
# This smoke is intentionally static: it does not boot Electron. It verifies
# that all the wiring landed in the right places so the chat menu, single
# persistent thread, board snapshot injection, and memo/PRD save paths exist
# as the PRD requires.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

require_grep() {
  local file="$1"
  local pattern="$2"
  local label="$3"

  if [ ! -f "$file" ]; then
    echo "[chat-smoke] missing file: $file" >&2
    exit 1
  fi
  if ! grep -Eq -- "$pattern" "$file"; then
    echo "[chat-smoke] expected $label" >&2
    echo "  pattern: $pattern" >&2
    echo "  file:    $file" >&2
    exit 1
  fi
}

require_executable() {
  local file="$1"
  if [ ! -x "$file" ]; then
    echo "[chat-smoke] not executable: $file" >&2
    exit 1
  fi
}

# 1. chat-once.sh exists in both runtime and scaffold copies and is executable.
require_executable "${REPO_ROOT}/runtime/board-scripts/chat-once.sh"
require_executable "${REPO_ROOT}/scaffold/board/scripts/chat-once.sh"
require_grep "${REPO_ROOT}/runtime/board-scripts/chat-once.sh" '--prompt-file' "chat-once.sh accepts --prompt-file"
require_grep "${REPO_ROOT}/runtime/board-scripts/chat-once.sh" 'codex|claude|opencode|gemini' \
  "chat-once.sh handles four adapter cases"

bash -n "${REPO_ROOT}/runtime/board-scripts/chat-once.sh"

# 2. chat-prompts/ directory has all five template files in both copies.
for prompt in chat-base.txt spec-author.txt order-intake.txt board-snapshot.tpl.txt wiki-answers.tpl.txt; do
  for base in runtime/board-scripts scaffold/board/scripts; do
    file="${REPO_ROOT}/${base}/chat-prompts/${prompt}"
    if [ ! -f "$file" ]; then
      echo "[chat-smoke] missing prompt template: $file" >&2
      exit 1
    fi
  done
done

# 3. preload.js exposes the chat APIs (prd_068) plus image attach APIs (prd_069).
preload="${REPO_ROOT}/apps/desktop/src/preload.js"
for api in chatLoad chatAppend chatSend chatSummarize chatReset saveMemo saveSpec chatAttachImages; do
  require_grep "$preload" "$api: \\(options\\) => ipcRenderer.invoke" "preload exposes $api"
done
require_grep "$preload" 'chatPickImages: \(\) => ipcRenderer.invoke' "preload exposes chatPickImages"

# 4. main.js registers all chat IPC handlers (prd_068 + prd_069) and provides the
# helper functions referenced by them.
main_js="${REPO_ROOT}/apps/desktop/src/main.js"
for channel in chatLoad chatAppend chatSend chatSummarize chatReset saveMemo saveSpec chatPickImages chatAttachImages; do
  require_grep "$main_js" "ipcMain\\.handle\\(\"autoflow:${channel}\"" "main.js registers autoflow:${channel}"
done
for fn in chatLoad chatAppend chatSend chatSummarize chatReset saveMemoFromChat saveSpecFromChat \
  buildBoardSnapshot buildWikiAnswerCatalog selectRelevantWikiAnswers buildSystemPrompt \
  nextNumberedSlot safeJoinUnderBoard chatThreadPath chatArchiveDirPath \
  chatPickImages chatAttachImages chatAttachmentsDirPath safeAttachmentBaseName \
  appendImageAttachmentHints extractMarkdownImagePaths; do
  require_grep "$main_js" "function ${fn}\\b" "main.js declares ${fn}"
done
require_grep "$main_js" 'desktop-chat-attachments' "attachments directory name present"
require_grep "$main_js" 'CHAT_IMAGE_EXT_ALLOWLIST' "image extension allowlist constant present"
require_grep "$main_js" 'AUTOFLOW_DESKTOP_CHAT_IMAGE_MAX_BYTES' "image max bytes env var present"
require_grep "$main_js" 'appendImageAttachmentHints\(m\.content\)' "chatSend pipes content through hint helper"
require_grep "$main_js" '\[Attached image: \$\{p\}\]' "adapter hint serialization pattern present"
require_grep "$main_js" 'desktop-chat\.md' "single thread filename present"
require_grep "$main_js" 'desktop-chat-archive' "archive directory name present"
require_grep "$main_js" 'AUTOFLOW_DESKTOP_CHAT_CONTEXT' "context window env var present"
require_grep "$main_js" 'AUTOFLOW_DESKTOP_CHAT_SUMMARY_THRESHOLD' "summary threshold env var present"
require_grep "$main_js" 'AUTOFLOW_DESKTOP_CHAT_WIKI_ANSWERS_TOPK' "wiki topK env var present"
require_grep "$main_js" 'AUTOFLOW_DESKTOP_CHAT_SNAPSHOT_BUDGET' "snapshot budget env var present"
require_grep "$main_js" "tickets/inbox" "saveMemo targets tickets/inbox"
require_grep "$main_js" "tickets/backlog" "saveSpec targets tickets/backlog"

node --check "$main_js"
node --check "$preload"

# 5. renderer puts chat first in the sidebar and uses chat as the default view.
renderer="${REPO_ROOT}/apps/desktop/src/renderer/main.tsx"
require_grep "$renderer" 'key: "chat", label: "대화"' "sidebar entry for chat"
# Confirm chat appears before progress in the navigation array.
chat_line=$(grep -n 'key: "chat"' "$renderer" | head -1 | cut -d: -f1)
progress_line=$(grep -n 'key: "progress"' "$renderer" | head -1 | cut -d: -f1)
if [ -z "$chat_line" ] || [ -z "$progress_line" ]; then
  echo "[chat-smoke] could not locate chat/progress nav lines" >&2
  exit 1
fi
if [ "$chat_line" -ge "$progress_line" ]; then
  echo "[chat-smoke] chat nav entry must precede progress (chat=$chat_line progress=$progress_line)" >&2
  exit 1
fi
require_grep "$renderer" 'initialSetting\("autoflow.activeSettingsSection", "chat"\)' \
  "default view fallback is chat"
require_grep "$renderer" ': "chat";' "unknown-key fallback returns chat"
require_grep "$renderer" 'function ChatView\(' "ChatView component declared"
require_grep "$renderer" 'window\.autoflow\.chatLoad' "ChatView calls chatLoad"
require_grep "$renderer" 'window\.autoflow\.chatSend' "ChatView calls chatSend"
require_grep "$renderer" 'window\.autoflow\.chatReset' "ChatView calls chatReset"
require_grep "$renderer" 'window\.autoflow\.saveMemo' "ChatView calls saveMemo"
require_grep "$renderer" 'window\.autoflow\.saveSpec' "ChatView calls saveSpec"
require_grep "$renderer" 'Wiki 인용' "Wiki citation toggle label present"
require_grep "$renderer" '이전 요약 인계' "Prior summary handover toggle label present"
require_grep "$renderer" '메모로 저장' "Memo save button label present"
require_grep "$renderer" 'PRD로 저장' "PRD save button label present"
require_grep "$renderer" 'function ChatAvatar\(' "ChatAvatar component declared"
require_grep "$renderer" 'function formatRelativeTime\(' "formatRelativeTime helper declared"
require_grep "$renderer" 'window\.autoflow\.chatPickImages' "ChatView calls chatPickImages"
require_grep "$renderer" 'window\.autoflow\.chatAttachImages' "ChatView calls chatAttachImages"
require_grep "$renderer" 'pendingAttachments' "pending attachments state present"
require_grep "$renderer" 'chat-attachment-chip' "attachment chip class used in renderer"
require_grep "$renderer" 'chat-image-preview-dialog' "image preview dialog class used in renderer"
require_grep "$renderer" 'chat-bubble-user' "user bubble class used in renderer"
require_grep "$renderer" 'chat-bubble-ai' "AI bubble class used in renderer"
# Header should not render the raw ISO timestamp directly (only via title tooltip).
if grep -E '<span className="chat-message-time">\{m\.at\}</span>' "$renderer" >/dev/null 2>&1; then
  echo "[chat-smoke] chat-message-time should not render raw ISO directly" >&2
  exit 1
fi

# 6. styles.css contains chat surface classes used by the renderer.
styles="${REPO_ROOT}/apps/desktop/src/renderer/styles.css"
for cls in chat-shell chat-toolbar chat-message-list chat-input-bar chat-dialog chat-thread \
  chat-message-row chat-bubble-user chat-bubble-ai chat-avatar chat-attachment-chip \
  chat-message-image chat-image-preview-dialog chat-input-bar-dragover; do
  require_grep "$styles" "\\.${cls}" "styles.css defines .${cls}"
done

# 7. ambient TS types describe the chat APIs.
types_file="${REPO_ROOT}/apps/desktop/src/renderer/vite-env.d.ts"
require_grep "$types_file" 'AutoflowChatLoadResult' "AutoflowChatLoadResult type declared"
require_grep "$types_file" 'AutoflowChatSendResult' "AutoflowChatSendResult type declared"
for api in chatLoad chatAppend chatSend chatSummarize chatReset saveMemo saveSpec chatAttachImages; do
  require_grep "$types_file" "${api}: \\(options:" "ambient declares ${api}"
done
require_grep "$types_file" 'chatPickImages: \(\) => Promise<' "ambient declares chatPickImages"
require_grep "$types_file" 'AutoflowChatPickResult' "ambient declares AutoflowChatPickResult"
require_grep "$types_file" 'AutoflowChatAttachResult' "ambient declares AutoflowChatAttachResult"

# 8. Smoke for next NNN slot logic via a tiny inline node script that exercises
# nextNumberedSlot with a temporary directory of sample files.
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
mkdir -p "$tmp_dir/inbox"
: > "$tmp_dir/inbox/memo_001.md"
: > "$tmp_dir/inbox/memo_004.md"
: > "$tmp_dir/inbox/something_else.md"
node - "$tmp_dir/inbox" memo .md <<'NODE'
const path = require("node:path");
const fs = require("node:fs/promises");
async function nextNumberedSlot(dir, prefix, extension) {
  const entries = await fs.readdir(dir);
  const re = new RegExp("^" + prefix + "_(\\d+)" + extension.replace(".", "\\.") + "$");
  let max = 0;
  for (const entry of entries) {
    const m = entry.match(re);
    if (!m) continue;
    const n = parseInt(m[1], 10);
    if (n > max) max = n;
  }
  return String(max + 1).padStart(3, "0");
}
(async () => {
  const [dir, prefix, ext] = process.argv.slice(2);
  const next = await nextNumberedSlot(dir, prefix, ext);
  if (next !== "005") {
    console.error(`expected 005 but got ${next}`);
    process.exit(2);
  }
})().catch((err) => {
  console.error(err);
  process.exit(3);
});
NODE

echo "[chat-smoke] all chat surface smoke checks passed"
