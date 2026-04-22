#!/usr/bin/env bash

set -euo pipefail

PACKAGE_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_REPO_ROOT="$(cd "${PACKAGE_COMMON_DIR}/.." && pwd)"
TEMPLATE_BOARD_ROOT="${SOURCE_REPO_ROOT}/templates/board"
PACKAGE_VERSION_FILE="${SOURCE_REPO_ROOT}/VERSION"
SYNC_BACKUP_CREATED=0
SYNC_ACTION_RESULT=""

ensure_package_templates_present() {
  if [ ! -d "$TEMPLATE_BOARD_ROOT" ]; then
    echo "Template board root not found: $TEMPLATE_BOARD_ROOT" >&2
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
  [ -f "${board_root}/AGENTS.md" ] && [ -d "${board_root}/tickets" ] && [ -d "${board_root}/rules/spec" ]
}

render_text_file() {
  local source_file="$1"
  local target_file="$2"
  local board_dir_name="$3"
  local escaped_board_dir

  mkdir -p "$(dirname "$target_file")"
  escaped_board_dir="$(printf '%s' "$board_dir_name" | sed 's/[\/&]/\\&/g')"
  sed "s#autopilot/#${escaped_board_dir}/#g" "$source_file" > "$target_file"
}

managed_board_asset_entries() {
  cat <<'EOF'
template_text|AGENTS.md|AGENTS.md
template_text|README.md|README.md
source_text|agents/plan-to-ticket-agent.md|agents/plan-to-ticket-agent.md
source_text|agents/todo-queue-agent.md|agents/todo-queue-agent.md
source_text|agents/execution-agent.md|agents/execution-agent.md
source_text|agents/verifier-agent.md|agents/verifier-agent.md
source_text|automations/README.md|automations/README.md
source_text|automations/templates/heartbeat-set.template.toml|automations/templates/heartbeat-set.template.toml
source_text|automations/templates/plan-heartbeat.template.toml|automations/templates/plan-heartbeat.template.toml
source_text|automations/templates/todo-heartbeat.template.toml|automations/templates/todo-heartbeat.template.toml
source_text|automations/templates/execution-heartbeat.template.toml|automations/templates/execution-heartbeat.template.toml
source_text|automations/templates/verifier-heartbeat.template.toml|automations/templates/verifier-heartbeat.template.toml
source_text|rules/README.md|rules/README.md
source_text|rules/plan/README.md|rules/plan/README.md
source_text|rules/plan/plan_template.md|rules/plan/plan_template.md
source_executable|scripts/common.sh|scripts/common.sh
source_executable|scripts/start-plan.sh|scripts/start-plan.sh
source_executable|scripts/start-todo.sh|scripts/start-todo.sh
source_executable|scripts/start.sh|scripts/start.sh
source_executable|scripts/start-verifier.sh|scripts/start-verifier.sh
source_text|rules/spec/README.md|rules/spec/README.md
source_text|rules/spec/project-spec-template.md|rules/spec/project-spec-template.md
source_text|rules/spec/feature-spec-template.md|rules/spec/feature-spec-template.md
source_text|tickets/README.md|tickets/README.md
source_text|tickets/tickets_template.md|tickets/tickets_template.md
source_text|rules/verifier/README.md|rules/verifier/README.md
source_text|rules/verifier/checklist-template.md|rules/verifier/checklist-template.md
source_text|rules/verifier/verification-template.md|rules/verifier/verification-template.md
EOF
}

managed_board_directory_entries() {
  cat <<'EOF'
agents
automations
automations/templates
rules
rules/spec
rules/plan
rules/verifier
scripts
tickets
tickets/todo
tickets/inprogress
tickets/done
tickets/runs
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
template_text|rules/spec/project_001.md|rules/spec/project_001.md
template_text|rules/plan/roadmap.md|rules/plan/roadmap.md
template_text|rules/plan/plan_001.md|rules/plan/plan_001.md
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
    source_file|source_executable)
      source_file="${SOURCE_REPO_ROOT}/${source_rel}"
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
  if [ "$asset_kind" = "source_executable" ]; then
    executable_flag="1"
  fi

  temp_file="$(build_asset_temp_file "$asset_kind" "$source_rel" "$board_dir_name")"
  sync_temp_file "$temp_file" "${board_root}/${target_rel}" "$backup_root" "$target_rel" "$executable_flag"
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

  if [ ! -f "${board_root}/.autopilot-version" ]; then
    return 1
  fi

  tr -d '\r\n' < "${board_root}/.autopilot-version"
}

write_board_version_marker() {
  local board_root="$1"
  local backup_root="${2:-}"
  local version

  version="$(package_version)"
  sync_literal_file "${board_root}/.autopilot-version" "$version" "$backup_root" ".autopilot-version"
}

sync_host_agents_file() {
  local target_file="$1"
  local board_dir_name="$2"
  local backup_root="${3:-}"
  local temp_file

  temp_file="$(mktemp)"
  render_text_file "${SOURCE_REPO_ROOT}/templates/host/AGENTS.md" "$temp_file" "$board_dir_name"
  sync_temp_file "$temp_file" "$target_file" "$backup_root" "AGENTS.md" "0"
  rm -f "$temp_file"
}
