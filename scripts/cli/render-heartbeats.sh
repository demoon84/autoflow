#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/cli-common.sh"

usage() {
  cat <<'EOF' >&2
Usage: render-heartbeats.sh [project-root] [board-dir-name]

Defaults:
  project-root   current directory
  board-dir-name autoflow
EOF
}

if [ $# -gt 2 ]; then
  usage
  exit 1
fi

project_root_input="${1:-.}"
board_dir_name="${2:-autoflow}"

project_root="$(resolve_project_root_or_die "$project_root_input")"
board_root="$(board_root_path "$project_root" "$board_dir_name")"
set_file="${board_root}/automations/heartbeat-set.toml"

if [ ! -f "$set_file" ]; then
  echo "Heartbeat set file not found: ${set_file}" >&2
  exit 1
fi

toml_string_value() {
  local file="$1"
  local key="$2"
  sed -n "s/^${key} = \"\\(.*\\)\"$/\\1/p" "$file" | head -n 1
}

toml_integer_value() {
  local file="$1"
  local key="$2"
  sed -n "s/^${key} = \\([0-9][0-9]*\\)$/\\1/p" "$file" | head -n 1
}

toml_array_values() {
  local file="$1"
  local key="$2"
  sed -n "s/^${key} = \\[\\(.*\\)\\]$/\\1/p" "$file" | head -n 1 | awk -F',' '
    {
      for (i = 1; i <= NF; i++) {
        value = $i
        gsub(/^[[:space:]]*"/, "", value)
        gsub(/"[[:space:]]*$/, "", value)
        gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)
        if (length(value) > 0) {
          print value
        }
      }
    }
  '
}

toml_section_value() {
  local file="$1"
  local section="$2"
  local key="$3"
  awk -v section="[$section]" -v key="$key" '
    $0 == section { in_section = 1; next }
    /^\[/ && in_section { in_section = 0 }
    in_section && $0 ~ "^"key"[[:space:]]*=" {
      if (match($0, /"[^"]*"/)) {
        print substr($0, RSTART + 1, RLENGTH - 2)
        exit
      }
    }
  ' "$file"
}

resolve_board_relative_path() {
  local rel="$1"
  case "$rel" in
    /*) printf '%s' "$rel" ;;
    *) printf '%s/%s' "$board_root" "$rel" ;;
  esac
}

slugify() {
  printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g; s/-\{2,\}/-/g; s/^-//; s/-$//'
}

escape_sed_replacement() {
  printf '%s' "${1:-}" | sed 's/[&|]/\\&/g'
}

render_template() {
  local template_file="$1"
  local output_file="$2"
  local automation_id="$3"
  local automation_name="$4"
  local worker_id="$5"
  local thread_id="$6"
  local escaped_thread_id escaped_automation_id escaped_automation_name
  local escaped_worker_id escaped_execution_pool escaped_verifier_pool escaped_max_load

  escaped_thread_id="$(escape_sed_replacement "$thread_id")"
  escaped_automation_id="$(escape_sed_replacement "$automation_id")"
  escaped_automation_name="$(escape_sed_replacement "$automation_name")"
  escaped_worker_id="$(escape_sed_replacement "$worker_id")"
  escaped_execution_pool="$(escape_sed_replacement "$execution_pool")"
  escaped_verifier_pool="$(escape_sed_replacement "$verifier_pool")"
  escaped_max_load="$(escape_sed_replacement "$max_execution_load")"

  mkdir -p "$(dirname "$output_file")"
  sed \
    -e "s|{{THREAD_ID}}|${escaped_thread_id}|g" \
    -e "s|{{AUTOMATION_ID}}|${escaped_automation_id}|g" \
    -e "s|{{AUTOMATION_NAME}}|${escaped_automation_name}|g" \
    -e "s|{{WORKER_ID}}|${escaped_worker_id}|g" \
    -e "s|{{EXECUTION_POOL}}|${escaped_execution_pool}|g" \
    -e "s|{{VERIFIER_POOL}}|${escaped_verifier_pool}|g" \
    -e "s|{{MAX_EXECUTION_LOAD}}|${escaped_max_load}|g" \
    "$template_file" > "$output_file"
}

append_manifest_entry() {
  local output_file="$1"
  local role="$2"
  local worker_id="$3"
  local automation_id="$4"
  local thread_id="$5"
  printf '%s|%s|%s|%s|%s\n' "$role" "$worker_id" "$automation_id" "$thread_id" "$output_file" >> "$manifest_tmp"
}

resolve_worker_thread_id() {
  local worker_id="$1"
  local found
  found="$(toml_section_value "$set_file" "thread_ids" "$worker_id")"
  if [ -n "$found" ] && ! printf '%s' "$found" | grep -qE 'REPLACE_WITH|{{'; then
    printf '%s' "$found"
    return 0
  fi
  printf '%s' "$target_thread_id"
}

set_name="$(toml_string_value "$set_file" "set_name")"
target_thread_id="$(toml_string_value "$set_file" "target_thread_id")"
execution_pool="$(toml_string_value "$set_file" "execution_pool")"
verifier_pool="$(toml_string_value "$set_file" "verifier_pool")"
max_execution_load="$(toml_integer_value "$set_file" "max_execution_load_per_worker")"

if [ -z "$set_name" ]; then
  echo "set_name is required in ${set_file}" >&2
  exit 1
fi

if [ -z "$target_thread_id" ] || printf '%s' "$target_thread_id" | grep -qE 'REPLACE_WITH|{{'; then
  echo "target_thread_id must be set to a real Codex thread id in ${set_file}" >&2
  exit 1
fi

if [ -z "$execution_pool" ]; then
  echo "execution_pool is required in ${set_file}" >&2
  exit 1
fi

if [ -z "$verifier_pool" ]; then
  echo "verifier_pool is required in ${set_file}" >&2
  exit 1
fi

if [ -z "$max_execution_load" ]; then
  max_execution_load="1"
fi

plan_template_rel="$(toml_string_value "$set_file" "plan_template")"
todo_template_rel="$(toml_string_value "$set_file" "todo_template")"
verifier_template_rel="$(toml_string_value "$set_file" "verifier_template")"

plan_template_file="$(resolve_board_relative_path "$plan_template_rel")"
todo_template_file="$(resolve_board_relative_path "$todo_template_rel")"
verifier_template_file="$(resolve_board_relative_path "$verifier_template_rel")"

for required_template in \
  "$plan_template_file" \
  "$todo_template_file" \
  "$verifier_template_file"
do
  if [ ! -f "$required_template" ]; then
    echo "Heartbeat template not found: ${required_template}" >&2
    exit 1
  fi
done

set_slug="$(slugify "$set_name")"
if [ -z "$set_slug" ]; then
  set_slug="autoflow-heartbeat-set"
fi

output_root="${board_root}/automations/rendered/${set_slug}"
manifest_tmp="$(autoflow_mktemp)"

rm -rf "$output_root"
mkdir -p "$output_root"

render_role_workers() {
  local role="$1"
  local array_key="$2"
  local template_file="$3"
  local worker_id automation_id automation_name output_file worker_thread_id

  while IFS= read -r worker_id; do
    [ -n "$worker_id" ] || continue
    automation_id="${set_slug}-${worker_id}"
    automation_name="${set_name} / ${worker_id}"
    output_file="${output_root}/${worker_id}.toml"
    worker_thread_id="$(resolve_worker_thread_id "$worker_id")"
    render_template "$template_file" "$output_file" "$automation_id" "$automation_name" "$worker_id" "$worker_thread_id"
    append_manifest_entry "$output_file" "$role" "$worker_id" "$automation_id" "$worker_thread_id"
    printf 'rendered=%s thread=%s\n' "$output_file" "$worker_thread_id"
  done < <(toml_array_values "$set_file" "$array_key")
}

render_role_workers "plan" "planner_workers" "$plan_template_file"
render_role_workers "todo" "todo_workers" "$todo_template_file"
render_role_workers "verifier" "verifier_workers" "$verifier_template_file"

rendered_count="$(wc -l < "$manifest_tmp" | tr -d ' ')"
if [ "$rendered_count" -eq 0 ]; then
  echo "No workers were rendered from ${set_file}" >&2
  exit 1
fi

manifest_file="${output_root}/manifest.txt"
{
  printf 'set_name=%s\n' "$set_name"
  printf 'target_thread_id=%s\n' "$target_thread_id"
  printf 'execution_pool=%s\n' "$execution_pool"
  printf 'verifier_pool=%s\n' "$verifier_pool"
  printf 'max_execution_load_per_worker=%s\n' "$max_execution_load"
  printf '\n'
  cat "$manifest_tmp"
} > "$manifest_file"

printf 'status=rendered\n'
printf 'project_root=%s\n' "$project_root"
printf 'board_root=%s\n' "$board_root"
printf 'set_file=%s\n' "$set_file"
printf 'output_root=%s\n' "$output_root"
printf 'rendered_count=%s\n' "$rendered_count"
printf 'manifest=%s\n' "$manifest_file"
