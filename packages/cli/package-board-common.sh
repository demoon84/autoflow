#!/usr/bin/env bash

set -euo pipefail

PACKAGE_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_REPO_ROOT="$(cd "${PACKAGE_COMMON_DIR}/../.." && pwd)"
TEMPLATE_BOARD_ROOT="${SOURCE_REPO_ROOT}/scaffold/board"
SCAFFOLD_MANIFEST_FILE="${SOURCE_REPO_ROOT}/scaffold/manifest.toml"
HOST_AGENTS_TEMPLATE="${SOURCE_REPO_ROOT}/scaffold/host/AGENTS.md"
HOST_CLAUDE_TEMPLATE="${SOURCE_REPO_ROOT}/scaffold/host/CLAUDE.md"
CLAUDE_SKILLS_ROOT="${SOURCE_REPO_ROOT}/integrations/claude/skills"
CODEX_SKILLS_ROOT="${SOURCE_REPO_ROOT}/integrations/codex/skills"
RUNTIME_SCRIPTS_ROOT="${SOURCE_REPO_ROOT}/runtime/board-scripts"
PACKAGE_VERSION_FILE="${SOURCE_REPO_ROOT}/VERSION"
SYNC_BACKUP_CREATED=0
SYNC_ACTION_RESULT=""

scaffold_manifest_value() {
  local section="$1"
  local key="$2"
  local fallback="$3"

  if [ ! -f "$SCAFFOLD_MANIFEST_FILE" ]; then
    printf '%s' "$fallback"
    return 0
  fi

  awk -v wanted_section="$section" -v wanted_key="$key" -v fallback="$fallback" '
    function trim(value) {
      sub(/^[[:space:]]+/, "", value)
      sub(/[[:space:]]+$/, "", value)
      return value
    }

    BEGIN { current_section = ""; found = 0 }

    {
      line = $0
      sub(/[[:space:]]*#.*/, "", line)
      line = trim(line)
      if (line == "") {
        next
      }
      if (line ~ /^\[[^]]+\]$/) {
        current_section = substr(line, 2, length(line) - 2)
        next
      }
      if (current_section == wanted_section) {
        separator = index(line, "=")
        if (separator == 0) {
          next
        }
        key = trim(substr(line, 1, separator - 1))
        if (key == wanted_key) {
          value = trim(substr(line, separator + 1))
          if (value ~ /^".*"$/) {
            value = substr(value, 2, length(value) - 2)
          }
          print value
          found = 1
          exit
        }
      }
    }

    END {
      if (!found) {
        print fallback
      }
    }
  ' "$SCAFFOLD_MANIFEST_FILE"
}

repo_relative_path() {
  local path_value="$1"

  case "$path_value" in
    /*|[A-Za-z]:[\\/]*)
      printf '%s' "$path_value"
      ;;
    *)
      printf '%s/%s' "$SOURCE_REPO_ROOT" "$path_value"
      ;;
  esac
}

TEMPLATE_BOARD_ROOT="$(repo_relative_path "$(scaffold_manifest_value sources board scaffold/board)")"
HOST_AGENTS_TEMPLATE="$(repo_relative_path "$(scaffold_manifest_value sources host scaffold/host/AGENTS.md)")"
HOST_CLAUDE_TEMPLATE="$(repo_relative_path "$(scaffold_manifest_value sources host_claude scaffold/host/CLAUDE.md)")"
CLAUDE_SKILLS_ROOT="$(repo_relative_path "$(scaffold_manifest_value sources claude_skills integrations/claude/skills)")"
CODEX_SKILLS_ROOT="$(repo_relative_path "$(scaffold_manifest_value sources codex_skills integrations/codex/skills)")"
RUNTIME_SCRIPTS_ROOT="$(repo_relative_path "$(scaffold_manifest_value sources runtime_scripts runtime/board-scripts)")"

default_board_dir_name() {
  scaffold_manifest_value install default_board_dir ".autoflow"
}

normalize_input_path() {
  local raw_path="$1"

  case "$raw_path" in
    [A-Za-z]:[\\/]*)
      if command -v wslpath >/dev/null 2>&1; then
        wslpath -a -u "$raw_path"
        return 0
      fi
      if command -v cygpath >/dev/null 2>&1; then
        cygpath -a -u "$raw_path"
        return 0
      fi
      ;;
  esac

  printf '%s' "$raw_path"
}

ensure_package_templates_present() {
  if [ ! -d "$TEMPLATE_BOARD_ROOT" ]; then
    echo "Template board root not found: $TEMPLATE_BOARD_ROOT" >&2
    exit 1
  fi

  if [ ! -d "$RUNTIME_SCRIPTS_ROOT" ]; then
    echo "Runtime scripts root not found: $RUNTIME_SCRIPTS_ROOT" >&2
    exit 1
  fi

  if [ ! -d "$CLAUDE_SKILLS_ROOT" ]; then
    echo "Claude skills root not found: $CLAUDE_SKILLS_ROOT" >&2
    exit 1
  fi

  if [ ! -d "$CODEX_SKILLS_ROOT" ]; then
    echo "Codex skills root not found: $CODEX_SKILLS_ROOT" >&2
    exit 1
  fi
}

package_version() {
  if [ -f "$PACKAGE_VERSION_FILE" ]; then
    tr -d '\r\n' < "$PACKAGE_VERSION_FILE"
    return 0
  fi

  printf '0.0.0-dev'
}

board_dir_has_entries() {
  find "$1" -mindepth 1 -maxdepth 1 -print -quit | grep -q .
}

board_already_initialized() {
  local board_root="$1"
  [ -f "${board_root}/AGENTS.md" ] && [ -d "${board_root}/tickets" ] && { [ -d "${board_root}/tickets/backlog" ] || [ -d "${board_root}/rules/spec" ]; }
}

render_text_file() {
  local source_file="$1"
  local target_file="$2"
  local board_dir_name="$3"
  local escaped_board_dir

  mkdir -p "$(dirname "$target_file")"
  escaped_board_dir="$(printf '%s' "$board_dir_name" | sed 's/[\/&]/\\&/g')"
  sed "s#{{BOARD_DIR}}#${escaped_board_dir}#g" "$source_file" > "$target_file"
}

managed_board_asset_entries() {
  cat <<'EOF'
template_text|AGENTS.md|AGENTS.md
template_text|README.md|README.md
template_text|agents/adapters/README.md|agents/adapters/README.md
template_text|agents/adapters/shell.md|agents/adapters/shell.md
template_text|agents/adapters/codex-cli.md|agents/adapters/codex-cli.md
template_text|agents/adapters/claude-cli.md|agents/adapters/claude-cli.md
template_text|agents/adapters/opencode.md|agents/adapters/opencode.md
template_text|agents/adapters/gemini-cli.md|agents/adapters/gemini-cli.md
template_text|agents/plan-to-ticket-agent.md|agents/plan-to-ticket-agent.md
template_text|agents/todo-queue-agent.md|agents/todo-queue-agent.md
template_text|agents/verifier-agent.md|agents/verifier-agent.md
template_text|agents/spec-author-agent.md|agents/spec-author-agent.md
template_text|agents/ticket-owner-agent.md|agents/ticket-owner-agent.md
template_text|agents/wiki-maintainer-agent.md|agents/wiki-maintainer-agent.md
template_text|conversations/README.md|conversations/README.md
template_text|automations/README.md|automations/README.md
template_text|automations/file-watch.psd1|automations/file-watch.psd1
template_text|automations/state/README.md|automations/state/README.md
template_text|automations/state/.gitignore|automations/state/.gitignore
template_text|automations/templates/heartbeat-set.template.toml|automations/templates/heartbeat-set.template.toml
template_text|automations/templates/ticket-owner-heartbeat.template.toml|automations/templates/ticket-owner-heartbeat.template.toml
template_text|automations/templates/plan-heartbeat.template.toml|automations/templates/plan-heartbeat.template.toml
template_text|automations/templates/todo-heartbeat.template.toml|automations/templates/todo-heartbeat.template.toml
template_text|automations/templates/verifier-heartbeat.template.toml|automations/templates/verifier-heartbeat.template.toml
template_text|rules/README.md|rules/README.md
template_text|rules/wiki/README.md|rules/wiki/README.md
template_text|rules/wiki/page-template.md|rules/wiki/page-template.md
template_text|rules/wiki/lint-checklist.md|rules/wiki/lint-checklist.md
template_text|reference/README.md|reference/README.md
template_text|reference/backlog.md|reference/backlog.md
template_text|reference/backlog-processed.md|reference/backlog-processed.md
template_text|reference/project-spec-template.md|reference/project-spec-template.md
template_text|reference/feature-spec-template.md|reference/feature-spec-template.md
template_text|reference/tickets-board.md|reference/tickets-board.md
template_text|reference/ticket-template.md|reference/ticket-template.md
template_text|reference/plan.md|reference/plan.md
template_text|reference/plan-template.md|reference/plan-template.md
template_text|reference/roadmap.md|reference/roadmap.md
template_text|reference/runner-harness.md|reference/runner-harness.md
template_text|reference/wiki.md|reference/wiki.md
template_text|reference/logs.md|reference/logs.md
template_text|reference/hook-logs.md|reference/hook-logs.md
template_text|runners/README.md|runners/README.md
template_text|runners/config.toml|runners/config.toml
template_text|runners/state/README.md|runners/state/README.md
template_text|runners/state/.gitignore|runners/state/.gitignore
template_text|runners/logs/README.md|runners/logs/README.md
template_text|runners/logs/.gitignore|runners/logs/.gitignore
template_text|metrics/README.md|metrics/README.md
template_text|metrics/.gitignore|metrics/.gitignore
template_text|wiki/index.md|wiki/index.md
template_text|wiki/log.md|wiki/log.md
template_text|wiki/project-overview.md|wiki/project-overview.md
template_text|wiki/decisions/README.md|wiki/decisions/README.md
template_text|wiki/features/README.md|wiki/features/README.md
template_text|wiki/architecture/README.md|wiki/architecture/README.md
template_text|wiki/learnings/README.md|wiki/learnings/README.md
runtime_executable|common.sh|scripts/common.sh
runtime_executable|runner-common.sh|scripts/runner-common.sh
runtime_executable|check-stop.sh|scripts/check-stop.sh
runtime_executable|file-watch-common.sh|scripts/file-watch-common.sh
runtime_executable|install-stop-hook.sh|scripts/install-stop-hook.sh
runtime_executable|run-hook.sh|scripts/run-hook.sh
runtime_executable|set-thread-context.sh|scripts/set-thread-context.sh
runtime_executable|clear-thread-context.sh|scripts/clear-thread-context.sh
runtime_executable|start-ticket-owner.sh|scripts/start-ticket-owner.sh
runtime_executable|verify-ticket-owner.sh|scripts/verify-ticket-owner.sh
runtime_executable|finish-ticket-owner.sh|scripts/finish-ticket-owner.sh
runtime_executable|update-wiki.sh|scripts/update-wiki.sh
runtime_executable|start-plan.sh|scripts/start-plan.sh
runtime_executable|start-todo.sh|scripts/start-todo.sh
runtime_executable|handoff-todo.sh|scripts/handoff-todo.sh
runtime_executable|start-verifier.sh|scripts/start-verifier.sh
runtime_executable|start-spec.sh|scripts/start-spec.sh
runtime_executable|integrate-worktree.sh|scripts/integrate-worktree.sh
runtime_file|invoke-runtime-sh.ps1|scripts/invoke-runtime-sh.ps1
runtime_file|runner-common.ps1|scripts/runner-common.ps1
runtime_file|codex-stop-hook.ps1|scripts/codex-stop-hook.ps1
runtime_file|check-stop.ps1|scripts/check-stop.ps1
runtime_file|install-stop-hook.ps1|scripts/install-stop-hook.ps1
runtime_file|set-thread-context.ps1|scripts/set-thread-context.ps1
runtime_file|clear-thread-context.ps1|scripts/clear-thread-context.ps1
runtime_file|start-ticket-owner.ps1|scripts/start-ticket-owner.ps1
runtime_file|verify-ticket-owner.ps1|scripts/verify-ticket-owner.ps1
runtime_file|finish-ticket-owner.ps1|scripts/finish-ticket-owner.ps1
runtime_file|start-spec.ps1|scripts/start-spec.ps1
runtime_file|start-plan.ps1|scripts/start-plan.ps1
runtime_file|start-todo.ps1|scripts/start-todo.ps1
runtime_file|handoff-todo.ps1|scripts/handoff-todo.ps1
runtime_file|start-verifier.ps1|scripts/start-verifier.ps1
runtime_file|integrate-worktree.ps1|scripts/integrate-worktree.ps1
runtime_file|write-verifier-log.ps1|scripts/write-verifier-log.ps1
runtime_file|run-hook.ps1|scripts/run-hook.ps1
runtime_file|watch-board.ps1|scripts/watch-board.ps1
runtime_executable|watch-board.sh|scripts/watch-board.sh
template_text|rules/verifier/README.md|rules/verifier/README.md
template_text|rules/verifier/checklist-template.md|rules/verifier/checklist-template.md
template_text|rules/verifier/verification-template.md|rules/verifier/verification-template.md
runtime_executable|write-verifier-log.sh|scripts/write-verifier-log.sh
EOF
}

managed_board_directory_entries() {
  cat <<'EOF'
agents
agents/adapters
automations
automations/state
automations/state/threads
automations/templates
conversations
reference
rules
rules/verifier
rules/wiki
scripts
runners
runners/state
runners/logs
metrics
wiki
wiki/decisions
wiki/features
wiki/architecture
wiki/learnings
logs
logs/hooks
tickets
tickets/backlog
tickets/plan
tickets/todo
tickets/inprogress
tickets/verifier
tickets/done
tickets/reject
EOF
}

ensure_board_directories() {
  local board_root="$1"
  local rel_dir

  while IFS= read -r rel_dir; do
    [ -n "$rel_dir" ] || continue
    mkdir -p "${board_root}/${rel_dir}"
  done < <(managed_board_directory_entries)
}

starter_board_state_asset_entries() {
  cat <<'EOF'
template_text|automations/heartbeat-set.toml|automations/heartbeat-set.toml
EOF
}

managed_host_skill_asset_entries() {
  cat <<'EOF'
claude_skill_text|autoflow/SKILL.md|.claude/skills/autoflow/SKILL.md
claude_skill_text|af/SKILL.md|.claude/skills/af/SKILL.md
codex_skill_text|autoflow/SKILL.md|.codex/skills/autoflow/SKILL.md
codex_skill_text|autoflow/agents/openai.yaml|.codex/skills/autoflow/agents/openai.yaml
codex_skill_text|af/SKILL.md|.codex/skills/af/SKILL.md
codex_skill_text|af/agents/openai.yaml|.codex/skills/af/agents/openai.yaml
EOF
}

build_asset_temp_file() {
  local asset_kind="$1"
  local source_rel="$2"
  local board_dir_name="$3"
  local temp_file source_file

  temp_file="$(mktemp)"

  case "$asset_kind" in
    template_text)
      source_file="${TEMPLATE_BOARD_ROOT}/${source_rel}"
      render_text_file "$source_file" "$temp_file" "$board_dir_name"
      ;;
    source_text)
      source_file="${SOURCE_REPO_ROOT}/${source_rel}"
      render_text_file "$source_file" "$temp_file" "$board_dir_name"
      ;;
    claude_skill_text)
      source_file="${CLAUDE_SKILLS_ROOT}/${source_rel}"
      render_text_file "$source_file" "$temp_file" "$board_dir_name"
      ;;
    codex_skill_text)
      source_file="${CODEX_SKILLS_ROOT}/${source_rel}"
      render_text_file "$source_file" "$temp_file" "$board_dir_name"
      ;;
    source_file|source_executable)
      source_file="${SOURCE_REPO_ROOT}/${source_rel}"
      cp "$source_file" "$temp_file"
      ;;
    runtime_file|runtime_executable)
      source_file="${RUNTIME_SCRIPTS_ROOT}/${source_rel}"
      cp "$source_file" "$temp_file"
      ;;
    *)
      rm -f "$temp_file"
      echo "Unknown asset kind: ${asset_kind}" >&2
      exit 1
      ;;
  esac

  printf '%s' "$temp_file"
}

sync_temp_file() {
  local temp_file="$1"
  local target_file="$2"
  local backup_root="${3:-}"
  local backup_rel="${4:-}"
  local executable_flag="${5:-0}"
  local target_exists action

  SYNC_BACKUP_CREATED=0
  mkdir -p "$(dirname "$target_file")"

  target_exists="false"
  if [ -f "$target_file" ]; then
    target_exists="true"
  fi

  if [ "$target_exists" = "true" ] && cmp -s "$temp_file" "$target_file"; then
    if [ "$executable_flag" = "1" ] && [ ! -x "$target_file" ]; then
      chmod +x "$target_file"
      SYNC_ACTION_RESULT="updated"
      return 0
    fi

    SYNC_ACTION_RESULT="unchanged"
    return 0
  fi

  if [ "$target_exists" = "true" ] && [ -n "$backup_root" ] && [ -n "$backup_rel" ]; then
    mkdir -p "${backup_root}/$(dirname "$backup_rel")"
    cp "$target_file" "${backup_root}/${backup_rel}"
    SYNC_BACKUP_CREATED=1
  fi

  cp "$temp_file" "$target_file"
  if [ "$executable_flag" = "1" ]; then
    chmod +x "$target_file"
  fi

  action="updated"
  if [ "$target_exists" = "false" ]; then
    action="created"
  fi

  SYNC_ACTION_RESULT="$action"
}

sync_board_asset() {
  local board_root="$1"
  local board_dir_name="$2"
  local asset_kind="$3"
  local source_rel="$4"
  local target_rel="$5"
  local backup_root="${6:-}"
  local temp_file executable_flag

  executable_flag="0"
  if [ "$asset_kind" = "source_executable" ] || [ "$asset_kind" = "runtime_executable" ]; then
    executable_flag="1"
  fi

  temp_file="$(build_asset_temp_file "$asset_kind" "$source_rel" "$board_dir_name")"
  sync_temp_file "$temp_file" "${board_root}/${target_rel}" "$backup_root" "$target_rel" "$executable_flag"
  rm -f "$temp_file"
}

sync_host_skill_asset() {
  local target_project_root="$1"
  local board_dir_name="$2"
  local asset_kind="$3"
  local source_rel="$4"
  local target_rel="$5"
  local backup_root="${6:-}"
  local temp_file

  temp_file="$(build_asset_temp_file "$asset_kind" "$source_rel" "$board_dir_name")"
  sync_temp_file "$temp_file" "${target_project_root}/${target_rel}" "$backup_root" "$target_rel" "0"
  rm -f "$temp_file"
}

sync_host_skill_asset_if_missing() {
  local target_project_root="$1"
  local board_dir_name="$2"
  local asset_kind="$3"
  local source_rel="$4"
  local target_rel="$5"
  local temp_file target_file

  temp_file="$(build_asset_temp_file "$asset_kind" "$source_rel" "$board_dir_name")"
  target_file="${target_project_root}/${target_rel}"

  if [ -f "$target_file" ] && ! cmp -s "$temp_file" "$target_file"; then
    SYNC_BACKUP_CREATED=0
    SYNC_ACTION_RESULT="preserved"
    rm -f "$temp_file"
    return 0
  fi

  sync_temp_file "$temp_file" "$target_file" "" "$target_rel" "0"
  rm -f "$temp_file"
}

sync_literal_file() {
  local target_file="$1"
  local literal_content="$2"
  local backup_root="${3:-}"
  local backup_rel="${4:-}"
  local temp_file

  temp_file="$(mktemp)"
  printf '%s\n' "$literal_content" > "$temp_file"
  sync_temp_file "$temp_file" "$target_file" "$backup_root" "$backup_rel" "0"
  rm -f "$temp_file"
}

write_project_root_marker() {
  local board_root="$1"
  local backup_root="${2:-}"
  sync_literal_file "${board_root}/.project-root" ".." "$backup_root" ".project-root"
}

board_version_value() {
  local board_root="$1"

  if [ ! -f "${board_root}/.autoflow-version" ]; then
    return 1
  fi

  tr -d '\r\n' < "${board_root}/.autoflow-version"
}

write_board_version_marker() {
  local board_root="$1"
  local backup_root="${2:-}"
  local version

  version="$(package_version)"
  sync_literal_file "${board_root}/.autoflow-version" "$version" "$backup_root" ".autoflow-version"
}

sync_host_agents_file() {
  local target_file="$1"
  local board_dir_name="$2"
  local backup_root="${3:-}"
  local temp_file

  temp_file="$(mktemp)"
  render_text_file "$HOST_AGENTS_TEMPLATE" "$temp_file" "$board_dir_name"
  sync_temp_file "$temp_file" "$target_file" "$backup_root" "AGENTS.md" "0"
  rm -f "$temp_file"
}

sync_host_claude_file() {
  local target_file="$1"
  local board_dir_name="$2"
  local backup_root="${3:-}"
  local temp_file

  [ -f "$HOST_CLAUDE_TEMPLATE" ] || return 0

  temp_file="$(mktemp)"
  render_text_file "$HOST_CLAUDE_TEMPLATE" "$temp_file" "$board_dir_name"
  sync_temp_file "$temp_file" "$target_file" "$backup_root" "CLAUDE.md" "0"
  rm -f "$temp_file"
}

backup_board_file_once() {
  local board_root="$1"
  local path="$2"
  local backup_root="${3:-}"

  [ -n "$backup_root" ] || return 0
  [ -f "$path" ] || return 0

  case "$path" in
    "${board_root}/"*)
      local rel="${path#${board_root}/}"
      if [ ! -f "${backup_root}/${rel}" ]; then
        mkdir -p "${backup_root}/$(dirname "$rel")"
        cp "$path" "${backup_root}/${rel}"
        SYNC_BACKUP_CREATED=1
      fi
      ;;
  esac
}

replace_literal_in_file() {
  local file="$1"
  local before="$2"
  local after="$3"
  local tmp before_escaped after_escaped

  [ -f "$file" ] || return 1
  before_escaped="$(printf '%s' "$before" | sed 's/[\/&]/\\&/g')"
  after_escaped="$(printf '%s' "$after" | sed 's/[\/&]/\\&/g')"
  tmp="$(mktemp)"
  sed "s/${before_escaped}/${after_escaped}/g" "$file" > "$tmp"
  if cmp -s "$tmp" "$file"; then
    rm -f "$tmp"
    return 1
  fi
  mv "$tmp" "$file"
  return 0
}
