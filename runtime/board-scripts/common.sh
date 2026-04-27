#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

AUTOFLOW_TMP_FILES=()
AUTOFLOW_TMP_REGISTRY="${TMPDIR:-/tmp}/autoflow-tmp-registry.$$"

autoflow_mktemp() {
  local tmp

  tmp="$(mktemp "${TMPDIR:-/tmp}/autoflow.XXXXXX")"
  AUTOFLOW_TMP_FILES+=("$tmp")
  printf '%s\n' "$tmp" >> "$AUTOFLOW_TMP_REGISTRY"
  printf '%s' "$tmp"
}

autoflow_cleanup_tmp() {
  local tmp

  if [ -f "$AUTOFLOW_TMP_REGISTRY" ]; then
    while IFS= read -r tmp; do
      [ -n "$tmp" ] || continue
      rm -f "$tmp" 2>/dev/null || true
    done < "$AUTOFLOW_TMP_REGISTRY"
    rm -f "$AUTOFLOW_TMP_REGISTRY" 2>/dev/null || true
  fi

  for tmp in "${AUTOFLOW_TMP_FILES[@]:-}"; do
    [ -n "$tmp" ] || continue
    rm -f "$tmp" 2>/dev/null || true
  done
}

trap autoflow_cleanup_tmp EXIT

normalize_runtime_path() {
  local raw="${1:-}"
  local drive rest flavor

  case "$raw" in
    [A-Za-z]:[\\/]*)
      drive="$(printf '%s' "${raw%%:*}" | tr '[:upper:]' '[:lower:]')"
      rest="${raw#?:}"
      rest="${rest//\\//}"
      rest="${rest#/}"
      flavor="${AUTOFLOW_BASH_FLAVOR:-}"
      if [ -z "$flavor" ]; then
        case "$(uname -s 2>/dev/null || true)" in
          MINGW*|MSYS*) flavor="msys" ;;
          CYGWIN*) flavor="cygwin" ;;
          *) flavor="wsl" ;;
        esac
      fi
      case "$flavor" in
        msys) printf '/%s/%s' "$drive" "$rest" ;;
        cygwin) printf '/cygdrive/%s/%s' "$drive" "$rest" ;;
        *) printf '/mnt/%s/%s' "$drive" "$rest" ;;
      esac
      ;;
    *)
      printf '%s' "$raw"
      ;;
  esac
}

display_worker_id() {
  local raw="${1:-}"
  local prefix suffix

  [ -n "$raw" ] || return 0

  prefix="${raw%%-*}"
  if [ "$prefix" = "$raw" ]; then
    printf '%s' "$raw"
    return 0
  fi

  suffix="${raw#*-}"
  case "$prefix" in
    owner|worker|ai|AI)
      printf 'AI-%s' "$suffix"
      ;;
    *)
      printf '%s' "$raw"
      ;;
  esac
}

worker_id_matches_field() {
  local field_value="${1:-}"
  local worker_value="${2:-}"

  [ -n "$field_value" ] || return 1
  [ -n "$worker_value" ] || return 1
  [ "$(display_worker_id "$field_value")" = "$(display_worker_id "$worker_value")" ]
}

BOARD_ROOT="$(normalize_runtime_path "${AUTOFLOW_BOARD_ROOT:-$(cd "${SCRIPT_DIR}/.." && pwd)}")"

resolve_project_root() {
  local configured resolved

  if [ -n "${AUTOFLOW_PROJECT_ROOT:-}" ]; then
    cd "$(normalize_runtime_path "${AUTOFLOW_PROJECT_ROOT}")" && pwd
    return 0
  fi

  if [ -f "${BOARD_ROOT}/.project-root" ]; then
    configured="$(tr -d '\r\n' < "${BOARD_ROOT}/.project-root")"
    if [ -z "${configured}" ]; then
      configured=".."
    fi
    case "${configured}" in
      /*|[A-Za-z]:[\\/]*)
        resolved="$(normalize_runtime_path "${configured}")"
        ;;
      *) resolved="${BOARD_ROOT}/${configured}" ;;
    esac
    cd "${resolved}" && pwd
    return 0
  fi

  cd "${BOARD_ROOT}/.." && pwd
}

PROJECT_ROOT="$(resolve_project_root)"

now_iso() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

board_relative_path() {
  local path="${1:-}"

  case "$path" in
    "${BOARD_ROOT}/"*)
      printf '%s' "${path#${BOARD_ROOT}/}"
      ;;
    "$BOARD_ROOT")
      printf '.'
      ;;
    *)
      printf '%s' "$path"
      ;;
  esac
}

git_root_path() {
  git -C "$PROJECT_ROOT" rev-parse --show-toplevel 2>/dev/null
}

git_head_commit() {
  local git_root="$1"
  git -C "$git_root" rev-parse --verify HEAD 2>/dev/null
}

allowed_path_is_concrete_repo_path() {
  local path="${1:-}"

  case "$path" in
    ""|TODO:*|TODO|todo:*|todo|/*|../*|*/../*|*"*"*|*"?"*|*"["*|*"]"*)
      return 1
      ;;
    *)
      return 0
      ;;
  esac
}

worktree_auto_fallback_reason() {
  local ticket_file="$1"
  local git_root="$2"
  local allowed_path status

  case "${AUTOFLOW_WORKTREE_MODE:-auto}" in
    project-root-on-dirty|PROJECT_ROOT_ON_DIRTY|fallback-on-dirty|FALLBACK_ON_DIRTY)
      ;;
    *)
      return 1
      ;;
  esac

  while IFS= read -r allowed_path; do
    [ -n "$allowed_path" ] || continue
    allowed_path_is_concrete_repo_path "$allowed_path" || continue
    status="$(git -C "$git_root" status --porcelain --untracked-files=all -- "$allowed_path" 2>/dev/null || true)"
    if [ -n "$status" ]; then
      printf 'dirty_allowed_path:%s' "$allowed_path"
      return 0
    fi
  done < <(extract_ticket_allowed_paths "$ticket_file")

  return 1
}

ticket_uses_project_root_workspace() {
  local ticket_file="$1"
  local status path physical_path physical_project_root

  status="$(trim_spaces "$(ticket_worktree_field "$ticket_file" "Integration Status")")"
  path="$(ticket_worktree_path_from_file "$ticket_file")"

  case "$status" in
    project_root_fallback|disabled|not_git_repo|no_head_commit)
      return 0
      ;;
  esac

  if [ -z "$path" ]; then
    return 0
  fi

  if [ -d "$path" ] && [ -d "$PROJECT_ROOT" ]; then
    physical_path="$(cd "$path" && pwd -P)"
    physical_project_root="$(cd "$PROJECT_ROOT" && pwd -P)"
    [ "$physical_path" = "$physical_project_root" ] && return 0
  fi

  return 1
}

ticket_project_root_conflict_stage() {
  case "${1:-}" in
    planning|claimed|executing|ready_for_verification|verifying|blocked|ready-to-merge|merge-blocked)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

ticket_concrete_allowed_paths() {
  local ticket_file="$1"
  local allowed_path

  while IFS= read -r allowed_path; do
    [ -n "$allowed_path" ] || continue
    allowed_path_is_concrete_repo_path "$allowed_path" || continue
    printf '%s\n' "$allowed_path"
  done < <(extract_ticket_allowed_paths "$ticket_file") | sort -u
}

ticket_shared_allowed_path_blockers() {
  local ticket_file="$1"
  local ticket_id ticket_num current_paths other_file other_id other_num other_stage
  local other_path current_project_root_workspace=false found=false

  [ -f "$ticket_file" ] || return 1

  ticket_id="$(extract_numeric_id "$ticket_file" 2>/dev/null || true)"
  [ -n "$ticket_id" ] || return 1
  ticket_num="$((10#$ticket_id))"
  current_paths="$(ticket_concrete_allowed_paths "$ticket_file")"
  [ -n "$current_paths" ] || return 1
  if ticket_uses_project_root_workspace "$ticket_file"; then
    current_project_root_workspace=true
  fi

  while IFS= read -r other_file; do
    [ -n "$other_file" ] || continue
    [ "$other_file" != "$ticket_file" ] || continue

    other_id="$(extract_numeric_id "$other_file" 2>/dev/null || true)"
    [ -n "$other_id" ] || continue
    other_num="$((10#$other_id))"
    [ "$other_num" -lt "$ticket_num" ] || continue

    other_stage="$(ticket_stage "$other_file")"
    ticket_project_root_conflict_stage "$other_stage" || continue
    if [ "$current_project_root_workspace" != "true" ] && ! ticket_uses_project_root_workspace "$other_file"; then
      continue
    fi

    while IFS= read -r other_path; do
      [ -n "$other_path" ] || continue
      if printf '%s\n' "$current_paths" | grep -Fqx -- "$other_path"; then
        printf 'tickets_%s:%s\n' "$other_id" "$other_path"
        found=true
      fi
    done < <(ticket_concrete_allowed_paths "$other_file")
  done < <(
    list_matching_files "${BOARD_ROOT}/tickets/inprogress" 'tickets_*.md'
    list_matching_files "${BOARD_ROOT}/tickets/ready-to-merge" 'tickets_*.md'
    list_matching_files "${BOARD_ROOT}/tickets/merge-blocked" 'tickets_*.md'
  )

  [ "$found" = "true" ]
}

ticket_shared_nonbase_head_blockers() {
  local ticket_file="$1"
  local ticket_id worktree_path base_commit current_head other_file other_id
  local other_stage other_path other_head found=false

  [ -f "$ticket_file" ] || return 1

  ticket_id="$(extract_numeric_id "$ticket_file" 2>/dev/null || true)"
  [ -n "$ticket_id" ] || return 1
  worktree_path="$(ticket_worktree_path_from_file "$ticket_file")"
  [ -n "$worktree_path" ] && [ -d "$worktree_path" ] || return 1

  base_commit="$(strip_markdown_code_ticks "$(ticket_worktree_field "$ticket_file" "Base Commit")")"
  [ -n "$base_commit" ] || return 1
  current_head="$(git -C "$worktree_path" rev-parse --verify HEAD 2>/dev/null || true)"
  [ -n "$current_head" ] || return 1
  [ "$current_head" != "$base_commit" ] || return 1

  while IFS= read -r other_file; do
    [ -n "$other_file" ] || continue
    [ "$other_file" != "$ticket_file" ] || continue

    other_id="$(extract_numeric_id "$other_file" 2>/dev/null || true)"
    [ -n "$other_id" ] || continue
    other_stage="$(ticket_stage "$other_file")"
    ticket_project_root_conflict_stage "$other_stage" || continue
    other_path="$(ticket_worktree_path_from_file "$other_file")"
    [ -n "$other_path" ] && [ -d "$other_path" ] || continue
    other_head="$(git -C "$other_path" rev-parse --verify HEAD 2>/dev/null || true)"
    if [ "$other_head" = "$current_head" ]; then
      printf 'tickets_%s:%s\n' "$other_id" "$current_head"
      found=true
    fi
  done < <(
    list_matching_files "${BOARD_ROOT}/tickets/inprogress" 'tickets_*.md'
    list_matching_files "${BOARD_ROOT}/tickets/ready-to-merge" 'tickets_*.md'
    list_matching_files "${BOARD_ROOT}/tickets/merge-blocked" 'tickets_*.md'
  )

  [ "$found" = "true" ]
}

shared_allowed_path_blockers_summary() {
  awk '
    NF > 0 {
      if (out != "") out = out ", "
      out = out $0
    }
    END { print out }
  '
}

shared_nonbase_head_blockers_summary() {
  shared_allowed_path_blockers_summary
}

ticket_latest_runtime_block_event() {
  local ticket_file="$1"

  [ -f "$ticket_file" ] || return 1
  awk '
    /Runtime auto-blocked: shared_allowed_path_conflict/ { event="runtime_shared_allowed" }
    /Runtime auto-blocked: shared_nonbase_head_conflict/ { event="runtime_shared_nonbase" }
    /Auto-recovery .*shared Allowed Path blockers cleared/ { event="auto_recovered_shared_allowed" }
    /Auto-recovery .*cleared blocked worktree fields/ { event="auto_recovered" }
    END {
      if (event != "") {
        print event
        exit 0
      }
      exit 1
    }
  ' "$ticket_file" 2>/dev/null
}

mark_ticket_shared_allowed_path_blocked() {
  local ticket_file="$1"
  local worker="$2"
  local timestamp="$3"
  local blockers="$4"
  local summary display_worker

  display_worker="$(display_worker_id "$worker")"
  summary="$(printf '%s\n' "$blockers" | shared_allowed_path_blockers_summary)"
  replace_scalar_field_in_section "$ticket_file" "## Ticket" "Stage" "blocked"
  replace_scalar_field_in_section "$ticket_file" "## Ticket" "AI" "$display_worker"
  replace_scalar_field_in_section "$ticket_file" "## Ticket" "Claimed By" "$display_worker"
  replace_scalar_field_in_section "$ticket_file" "## Ticket" "Execution AI" "$display_worker"
  replace_scalar_field_in_section "$ticket_file" "## Ticket" "Verifier AI" "$display_worker"
  replace_scalar_field_in_section "$ticket_file" "## Ticket" "Last Updated" "$timestamp"
  replace_section_block "$ticket_file" "Next Action" "- Runtime wait: shared Allowed Paths are already held by lower-number in-progress ticket(s): ${summary}. Retry automatically when blockers clear."

  if ! grep -Fq "Runtime auto-blocked: shared_allowed_path_conflict" "$ticket_file"; then
    append_note "$ticket_file" "Runtime auto-blocked: shared_allowed_path_conflict at ${timestamp}; blockers=${summary}"
  fi
}

mark_ticket_shared_nonbase_head_blocked() {
  local ticket_file="$1"
  local worker="$2"
  local timestamp="$3"
  local blockers="$4"
  local summary display_worker

  display_worker="$(display_worker_id "$worker")"
  summary="$(printf '%s\n' "$blockers" | shared_nonbase_head_blockers_summary)"
  replace_scalar_field_in_section "$ticket_file" "## Ticket" "Stage" "blocked"
  replace_scalar_field_in_section "$ticket_file" "## Ticket" "AI" "$display_worker"
  replace_scalar_field_in_section "$ticket_file" "## Ticket" "Claimed By" "$display_worker"
  replace_scalar_field_in_section "$ticket_file" "## Ticket" "Execution AI" "$display_worker"
  replace_scalar_field_in_section "$ticket_file" "## Ticket" "Verifier AI" "$display_worker"
  replace_scalar_field_in_section "$ticket_file" "## Ticket" "Last Updated" "$timestamp"
  replace_section_block "$ticket_file" "Next Action" "- Runtime wait: this ticket worktree shares a non-base HEAD with other active ticket(s): ${summary}. Restore an isolated clean snapshot before owner verify/finish resumes."

  if ! grep -Fq "Runtime auto-blocked: shared_nonbase_head_conflict" "$ticket_file"; then
    append_note "$ticket_file" "Runtime auto-blocked: shared_nonbase_head_conflict at ${timestamp}; blockers=${summary}"
  fi
}

worktree_mode_disabled() {
  case "${AUTOFLOW_WORKTREE_MODE:-auto}" in
    0|off|OFF|false|FALSE|disabled|DISABLED)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

worktree_parent_root() {
  local git_root="$1"
  local configured repo_name parent_dir

  configured="${AUTOFLOW_WORKTREE_ROOT:-}"
  if [ -n "$configured" ]; then
    normalize_runtime_path "$configured"
    return 0
  fi

  repo_name="$(basename "$git_root")"
  parent_dir="$(dirname "$git_root")"
  printf '%s/.autoflow-worktrees/%s' "$parent_dir" "$repo_name"
}

ticket_worktree_branch_for_id() {
  local ticket_id="$1"
  printf 'autoflow/tickets_%s' "$ticket_id"
}

ticket_worktree_path_for_id() {
  local ticket_id="$1"
  local git_root parent_root

  git_root="$(git_root_path)" || return 1
  parent_root="$(worktree_parent_root "$git_root")"
  printf '%s/tickets_%s' "$parent_root" "$ticket_id"
}

hydrate_ticket_worktree_dependencies() {
  local ticket_file="$1"
  local worktree_path="$2"
  local project_root_normalized dep_dir rel_path target_path target_parent timestamp linked_any=false

  [ -d "$worktree_path" ] || return 0
  [ -d "$PROJECT_ROOT" ] || return 0

  project_root_normalized="${PROJECT_ROOT%/}"
  case "$worktree_path" in
    "$project_root_normalized")
      return 0
      ;;
  esac

  timestamp="$(now_iso)"
  while IFS= read -r dep_dir; do
    [ -n "$dep_dir" ] || continue
    case "$dep_dir" in
      "$project_root_normalized/"*)
        rel_path="${dep_dir#${project_root_normalized}/}"
        ;;
      *)
        continue
        ;;
    esac

    target_path="${worktree_path}/${rel_path}"
    target_parent="$(dirname "$target_path")"
    [ -d "$target_parent" ] || continue
    if [ -e "$target_path" ] || [ -L "$target_path" ]; then
      continue
    fi

    ln -s "$dep_dir" "$target_path"
    append_note "$ticket_file" "Runtime hydrated worktree dependency at ${timestamp}: linked ${rel_path} -> ${dep_dir}"
    printf 'worktree_dependency_link=%s\n' "$rel_path"
    linked_any=true
  done < <(find "$project_root_normalized" -maxdepth 4 -type d -name node_modules -prune 2>/dev/null | sort)

  if [ "$linked_any" = "true" ]; then
    printf 'worktree_dependency_status=linked\n'
  else
    printf 'worktree_dependency_status=unchanged\n'
  fi
}

owner_id() {
  if [ -n "${AUTOFLOW_WORKER_ID:-}" ]; then
    printf '%s' "${AUTOFLOW_WORKER_ID}"
    return 0
  fi
  if [ -n "${CODEX_AUTOMATION_ID:-}" ]; then
    printf '%s' "${CODEX_AUTOMATION_ID}"
    return 0
  fi
  if [ -n "${CODEX_THREAD_ID:-}" ]; then
    printf '%s' "${CODEX_THREAD_ID}"
    return 0
  fi
  printf '%s@%s:%s' "${USER:-unknown}" "${HOSTNAME:-localhost}" "$$"
}

pointer_token() {
  local raw="${1:-}"

  if [ -z "$raw" ]; then
    return 1
  fi

  raw="$(printf '%s' "$raw" | tr '[:upper:]' '[:lower:]')"
  raw="$(printf '%s' "$raw" | sed -E 's/[^a-z0-9._-]+/-/g; s/^-+//; s/-+$//; s/-+/-/g')"

  if [ -z "$raw" ]; then
    return 1
  fi

  printf '%s' "$raw"
}

current_thread_key() {
  local token

  token="$(pointer_token "${AUTOFLOW_THREAD_KEY:-}" || true)"
  if [ -n "$token" ]; then
    printf '%s' "$token"
    return 0
  fi

  token="$(pointer_token "${CODEX_THREAD_ID:-}" || true)"
  if [ -n "$token" ]; then
    printf '%s' "$token"
    return 0
  fi

  return 1
}

autoflow_state_root() {
  printf '%s/automations/state' "$BOARD_ROOT"
}

thread_state_root() {
  printf '%s/threads' "$(autoflow_state_root)"
}

ensure_state_dirs() {
  mkdir -p "$(thread_state_root)"
}

thread_context_path() {
  local key="${1:-}"

  if [ -z "$key" ]; then
    key="$(current_thread_key || true)"
  fi

  if [ -z "$key" ]; then
    return 1
  fi

  printf '%s/%s.context' "$(thread_state_root)" "$key"
}

current_context_path() {
  printf '%s/current.context' "$(autoflow_state_root)"
}

context_file_read_value() {
  local file="$1"
  local key="$2"

  [ -f "$file" ] || return 1

  awk -F= -v key="$key" '
    $1 == key {
      sub(/^[^=]*=/, "", $0)
      print
      exit
    }
  ' "$file"
}

context_effective_file() {
  local thread_file current_file

  thread_file="$(thread_context_path "$(current_thread_key || true)" || true)"
  if [ -n "$thread_file" ] && [ -f "$thread_file" ]; then
    printf '%s' "$thread_file"
    return 0
  fi

  current_file="$(current_context_path)"
  if [ -f "$current_file" ]; then
    printf '%s' "$current_file"
    return 0
  fi

  return 1
}

context_effective_value() {
  local key="$1"
  local file

  file="$(context_effective_file || true)"
  [ -n "$file" ] || return 1
  context_file_read_value "$file" "$key"
}

write_context_snapshot() {
  local role="$1"
  local worker_id="$2"
  local execution_pool="$3"
  local verifier_pool="$4"
  local active_ticket_id="$5"
  local active_ticket_path="$6"
  local active_stage="$7"
  local thread_key thread_file current_file temp_file timestamp active_updated_at

  ensure_state_dirs

  thread_key="$(current_thread_key || true)"
  thread_file=""
  if [ -n "$thread_key" ]; then
    thread_file="$(thread_context_path "$thread_key")"
  fi

  current_file="$(current_context_path)"
  temp_file="$(autoflow_mktemp)"
  timestamp="$(now_iso)"
  active_updated_at=""
  if [ -n "$active_ticket_id" ] || [ -n "$active_ticket_path" ] || [ -n "$active_stage" ]; then
    active_updated_at="$timestamp"
  fi

  cat > "$temp_file" <<EOF
role=${role}
worker_id=${worker_id}
thread_key=${thread_key}
board_root=${BOARD_ROOT}
project_root=${PROJECT_ROOT}
execution_pool=${execution_pool}
verifier_pool=${verifier_pool}
active_ticket_id=${active_ticket_id}
active_ticket_path=${active_ticket_path}
active_stage=${active_stage}
updated_at=${timestamp}
active_updated_at=${active_updated_at}
EOF

  if [ -n "$thread_file" ]; then
    cp "$temp_file" "$thread_file"
  fi
  cp "$temp_file" "$current_file"
  rm -f "$temp_file"
}

set_thread_context_record() {
  local role="$1"
  local worker_id="${2:-$(owner_id)}"
  local active_ticket_id="${3:-}"
  local active_stage="${4:-}"
  local active_ticket_path="${5:-}"
  local execution_pool verifier_pool

  execution_pool="${AUTOFLOW_EXECUTION_POOL:-$(context_effective_value "execution_pool" || true)}"
  verifier_pool="${AUTOFLOW_VERIFIER_POOL:-$(context_effective_value "verifier_pool" || true)}"

  write_context_snapshot \
    "$role" \
    "$worker_id" \
    "$execution_pool" \
    "$verifier_pool" \
    "$active_ticket_id" \
    "$active_ticket_path" \
    "$active_stage"
}

clear_active_ticket_context_record() {
  local context_file role worker_id execution_pool verifier_pool

  context_file="$(context_effective_file || true)"

  role="${AUTOFLOW_ROLE:-}"
  if [ -z "$role" ] && [ -n "$context_file" ]; then
    role="$(context_file_read_value "$context_file" "role" || true)"
  fi
  [ -n "$role" ] || return 1

  worker_id="${AUTOFLOW_WORKER_ID:-}"
  if [ -z "$worker_id" ] && [ -n "$context_file" ]; then
    worker_id="$(context_file_read_value "$context_file" "worker_id" || true)"
  fi
  if [ -z "$worker_id" ]; then
    worker_id="$(owner_id)"
  fi

  execution_pool="${AUTOFLOW_EXECUTION_POOL:-}"
  if [ -z "$execution_pool" ] && [ -n "$context_file" ]; then
    execution_pool="$(context_file_read_value "$context_file" "execution_pool" || true)"
  fi

  verifier_pool="${AUTOFLOW_VERIFIER_POOL:-}"
  if [ -z "$verifier_pool" ] && [ -n "$context_file" ]; then
    verifier_pool="$(context_file_read_value "$context_file" "verifier_pool" || true)"
  fi

  write_context_snapshot "$role" "$worker_id" "$execution_pool" "$verifier_pool" "" "" ""
}

worker_role() {
  printf '%s' "${AUTOFLOW_ROLE:-}"
}

background_mode_enabled() {
  case "${AUTOFLOW_BACKGROUND:-${AUTOFLOW_HEARTBEAT_MODE:-}}" in
    1|true|TRUE|yes|YES|on|ON)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

ensure_expected_role() {
  local expected_role="$1"
  local current_role

  current_role="$(worker_role)"
  if [ -n "$current_role" ] && [ "$current_role" != "$expected_role" ]; then
    echo "AUTOFLOW_ROLE=${current_role} cannot run ${expected_role} hook." >&2
    exit 1
  fi
}

idle_exit() {
  local reason="$1"
  printf 'status=idle\n'
  printf 'reason=%s\n' "$reason"
  printf 'worker_role=%s\n' "$(worker_role)"
  printf 'board_root=%s\n' "$BOARD_ROOT"
  printf 'project_root=%s\n' "$PROJECT_ROOT"
  exit 0
}

fail_or_idle() {
  local message="$1"
  local reason="$2"

  if background_mode_enabled; then
    idle_exit "$reason"
  fi

  echo "$message" >&2
  exit 1
}

trim_spaces() {
  printf '%s' "${1:-}" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//'
}

shell_quote() {
  local raw="${1:-}"
  printf "'%s'" "$(printf '%s' "$raw" | sed "s/'/'\\\\''/g")"
}

spec_file_is_placeholder() {
  local file="$1"
  [ -f "$file" ] || return 1
  if grep -qsF -- "<!-- AUTOFLOW_STARTER_SPEC_PLACEHOLDER -->" "$file"; then
    return 0
  fi
  grep -qsF -- "Replace with your project name" "$file"
}

plan_file_is_placeholder() {
  local file="$1"
  [ -f "$file" ] || return 1
  if grep -qsF -- "<!-- AUTOFLOW_STARTER_PLAN_PLACEHOLDER -->" "$file"; then
    return 0
  fi
  if grep -qsF -- "첫 구현 티켓 후보를 관찰 가능한 문장으로 적기" "$file"; then
    return 0
  fi
  grep -qsF -- "- Title: Initial project bootstrap" "$file"
}

field_is_unassigned() {
  case "$(trim_spaces "${1:-}")" in
    ""|unassigned|unclaimed|none)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

normalize_id() {
  local raw="${1:-}"
  raw="${raw##*_}"
  raw="${raw%.md}"
  raw="${raw//[^0-9]/}"
  if [ -z "${raw}" ]; then
    return 1
  fi
  printf '%03d' "$((10#${raw}))"
}

extract_numeric_id() {
  local path="$1"
  local base
  base="$(basename "$path")"
  normalize_id "$base"
}

list_matching_files() {
  local dir="$1"
  local pattern="$2"

  [ -d "$dir" ] || return 0
  find "$dir" -maxdepth 1 -type f -name "$pattern" | sort
}

lowest_matching_file() {
  local dir="$1"
  local pattern="$2"
  list_matching_files "$dir" "$pattern" | head -n 1
}

list_ticket_record_files_under() {
  local dir="$1"

  [ -d "$dir" ] || return 0
  find "$dir" -type f \( -name 'tickets_[0-9][0-9][0-9].md' -o -name 'reject_[0-9][0-9][0-9].md' \) | sort
}

list_reject_ticket_files() {
  local reject_dir="${BOARD_ROOT}/tickets/reject"

  [ -d "$reject_dir" ] || return 0
  find "$reject_dir" -maxdepth 1 -type f \( -name 'reject_[0-9][0-9][0-9].md' -o -name 'tickets_[0-9][0-9][0-9].md' \) | sort
}

reject_auto_replan_enabled() {
  case "${AUTOFLOW_REJECT_AUTO_REPLAN:-on}" in
    0|off|OFF|false|FALSE|disabled|DISABLED)
      return 1
      ;;
    *)
      return 0
      ;;
  esac
}

reject_max_retries() {
  local raw="${AUTOFLOW_REJECT_MAX_RETRIES:-10}"

  raw="${raw//[^0-9]/}"
  if [ -z "$raw" ]; then
    raw="2"
  fi

  printf '%s' "$((10#$raw))"
}

ticket_max_retries() {
  local file="$1"
  local value

  value="$(extract_scalar_field_in_section "$file" "Retry" "Max Retries" | tr -cd '0-9')"
  if [ -z "$value" ]; then
    reject_max_retries
    return 0
  fi

  printf '%s' "$((10#$value))"
}

list_reject_tickets_for_replan() {
  local file

  while IFS= read -r file; do
    [ -n "$file" ] || continue
    printf '%s\t%s\n' "$(stat -f '%m' "$file")" "$file"
  done < <(list_reject_ticket_files)
}

find_replannable_reject() {
  local skipped_file="${1:-}"
  local file retry_count max_retries rel

  reject_auto_replan_enabled || return 1

  while IFS=$'\t' read -r _ file; do
    [ -n "$file" ] || continue
    retry_count="$(ticket_retry_count "$file")"
    max_retries="$(ticket_max_retries "$file")"
    if [ "$retry_count" -lt "$max_retries" ]; then
      printf '%s' "$file"
      return 0
    fi

    if [ -n "$skipped_file" ]; then
      rel="$(board_relative_path "$file")"
      printf '%s|max_retries_reached|%s\n' "$rel" "$retry_count" >> "$skipped_file"
    fi
  done < <(list_reject_tickets_for_replan | sort -n)

  return 1
}

plan_root_path() {
  if [ -d "${BOARD_ROOT}/tickets/plan" ]; then
    printf '%s/tickets/plan' "$BOARD_ROOT"
    return 0
  fi

  if [ -d "${BOARD_ROOT}/rules/plan" ]; then
    printf '%s/rules/plan' "$BOARD_ROOT"
    return 0
  fi

  printf '%s/tickets/plan' "$BOARD_ROOT"
}

plan_inprogress_root_path() {
  printf '%s/tickets/inprogress' "$BOARD_ROOT"
}

lowest_ready_plan() {
  local plan_root
  plan_root="$(plan_root_path)"
  local file
  while IFS= read -r file; do
    [ -n "$file" ] || continue
    if awk '
      /^## Plan/ { in_plan=1; next }
      /^## / && in_plan { in_plan=0 }
      in_plan && $0 == "- Status: ready" { found=1 }
      END { exit(found ? 0 : 1) }
    ' "$file"; then
      printf '%s' "$file"
      return 0
    fi
  done < <(list_matching_files "$plan_root" 'plan_[0-9][0-9][0-9].md')
  return 1
}

ticket_path() {
  local state_dir="$1"
  local id="$2"
  local project_key="${3:-}"

  if [ "$state_dir" = "done" ] && [ -n "$project_key" ]; then
    printf '%s/tickets/done/%s/tickets_%s.md' "$BOARD_ROOT" "$project_key" "$id"
    return 0
  fi

  printf '%s/tickets/%s/tickets_%s.md' "$BOARD_ROOT" "$state_dir" "$id"
}

plan_path() {
  local id="$1"
  printf '%s/plan_%s.md' "$(plan_root_path)" "$id"
}

plan_inprogress_path() {
  local id="$1"
  printf '%s/plan_%s.md' "$(plan_inprogress_root_path)" "$id"
}

plan_id_from_ref() {
  local plan_ref="${1:-}"
  local note_name digits

  note_name="$(note_name_from_board_ref "$plan_ref")"
  digits="$(printf '%s' "$note_name" | sed -n 's/^plan_\([0-9][0-9][0-9]\)$/\1/p')"
  printf '%s' "$digits"
}

next_ticket_id() {
  local max_id=0
  local path id
  while IFS= read -r path; do
    [ -n "$path" ] || continue
    id="$(extract_numeric_id "$path" 2>/dev/null || true)"
    [ -n "$id" ] || continue
    if [ "$((10#$id))" -gt "$max_id" ]; then
      max_id="$((10#$id))"
    fi
  done < <(list_ticket_record_files_under "${BOARD_ROOT}/tickets")
  printf '%03d' "$((max_id + 1))"
}

replace_scalar_field_in_section() {
  local file="$1"
  local heading="$2"
  local field="$3"
  local value="$4"
  local tmp
  tmp="$(autoflow_mktemp)"
  awk -v heading="$heading" -v field="$field" -v value="$value" '
    BEGIN {
      in_target = 0
      replaced = 0
    }
    $0 == heading {
      print
      in_target = 1
      next
    }
    in_target && /^## / {
      if (!replaced) {
        print "- " field ": " value
        replaced = 1
      }
      in_target = 0
      print
      next
    }
    in_target && $0 ~ "^- " field ":" {
      print "- " field ": " value
      replaced = 1
      next
    }
    { print }
    END {
      if (in_target && !replaced) {
        print "- " field ": " value
      } else if (!replaced) {
        print ""
        print heading
        print "- " field ": " value
      }
    }
  ' "$file" > "$tmp"
  mv "$tmp" "$file"
}

replace_section_block() {
  local file="$1"
  local heading="$2"
  local block="$3"
  local tmp block_file
  tmp="$(autoflow_mktemp)"
  block_file="$(autoflow_mktemp)"
  printf '%s\n' "$block" > "$block_file"
  awk -v heading="$heading" -v block_file="$block_file" '
    BEGIN {
      while ((getline line < block_file) > 0) {
        lines[++line_count] = line
      }
      close(block_file)
      in_target = 0
      replaced = 0
    }
    $0 == "## " heading {
      print
      for (i = 1; i <= line_count; i++) {
        print lines[i]
      }
      in_target = 1
      replaced = 1
      next
    }
    in_target {
      if ($0 ~ /^## /) {
        in_target = 0
        print ""
        print
      }
      next
    }
    { print }
    END {
      if (!replaced) {
        print ""
        print "## " heading
        for (i = 1; i <= line_count; i++) {
          print lines[i]
        }
      }
    }
  ' "$file" > "$tmp"
  rm -f "$block_file"
  mv "$tmp" "$file"
}

append_note() {
  local file="$1"
  local note="$2"
  local tmp
  tmp="$(autoflow_mktemp)"
  awk -v note="$note" '
    BEGIN { in_notes=0; inserted=0 }
    $0 == "## Notes" {
      print
      in_notes=1
      next
    }
    in_notes && /^## / && !inserted {
      print "- " note
      inserted=1
      in_notes=0
      print
      next
    }
    { print }
    END {
      if (in_notes && !inserted) {
        print "- " note
      } else if (!inserted) {
        print ""
        print "## Notes"
        print "- " note
      }
    }
  ' "$file" > "$tmp"
  mv "$tmp" "$file"
}

append_generated_ticket() {
  local file="$1"
  local entry="$2"
  local tmp
  tmp="$(autoflow_mktemp)"
  awk -v entry="$entry" '
    BEGIN { insert_next=0; inserted=0 }
    $0 == "## Generated Tickets" {
      print
      print "- " entry
      insert_next=1
      inserted=1
      next
    }
    insert_next && $0 ~ /^- 아직 없음/ {
      insert_next=0
      next
    }
    { print }
    END {
      if (!inserted) {
        print ""
        print "## Generated Tickets"
        print "- " entry
      }
    }
  ' "$file" > "$tmp"
  mv "$tmp" "$file"
}

extract_execution_candidates() {
  local file="$1"
  awk '
    /^## Execution Candidates/ { in_section=1; next }
    /^## / { in_section=0 }
    in_section && /^[[:space:]]*- \[ \]/ {
      sub(/^[[:space:]]*- \[ \] /, "", $0)
      print
    }
  ' "$file"
}

extract_allowed_paths_block() {
  local file="$1"
  awk '
    /^## Ticket Rules/ { in_rules=1; next }
    /^## / { in_rules=0 }
    in_rules && /^[[:space:]]*- Allowed Paths:/ { in_allowed=1; next }
    in_allowed && /^[[:space:]]*- Ticket split notes:/ { in_allowed=0 }
    in_allowed && /^[[:space:]]+[-*] / { print substr($0, 3) }
  ' "$file"
}

extract_reference_value() {
  local file="$1"
  local heading="$2"
  local field="$3"
  awk -v heading="$heading" -v field="$field" '
    $0 == "## " heading { in_section=1; next }
    /^## / && in_section { in_section=0 }
    in_section && $0 ~ "^- " field ":" {
      sub("^- " field ": ?", "", $0)
      print
      exit
    }
  ' "$file"
}

extract_scalar_field_in_section() {
  local file="$1"
  local heading="$2"
  local field="$3"
  awk -v heading="$heading" -v field="$field" '
    $0 == "## " heading { in_section=1; next }
    /^## / && in_section { in_section=0 }
    in_section && $0 ~ "^- " field ":" {
      sub("^- " field ": ?", "", $0)
      print
      exit
    }
  ' "$file"
}

extract_section_text() {
  local file="$1"
  local heading="$2"

  awk -v heading="$heading" '
    $0 == "## " heading { in_section=1; next }
    /^## / && in_section { in_section=0 }
    in_section { print }
  ' "$file"
}

ticket_scalar_field() {
  local file="$1"
  local field="$2"
  extract_scalar_field_in_section "$file" "Ticket" "$field"
}

ticket_stage() {
  ticket_scalar_field "$1" "Stage"
}

ticket_worktree_field() {
  local file="$1"
  local field="$2"
  extract_scalar_field_in_section "$file" "Worktree" "$field"
}

ticket_worktree_path_from_file() {
  local ticket_file="$1"
  strip_markdown_code_ticks "$(ticket_worktree_field "$ticket_file" "Path")"
}

ticket_working_root() {
  local ticket_file="$1"
  local worktree_path

  worktree_path="$(ticket_worktree_path_from_file "$ticket_file")"
  if [ -n "$worktree_path" ] && [ -d "$worktree_path" ]; then
    cd "$worktree_path" && pwd
    return 0
  fi

  printf '%s' "$PROJECT_ROOT"
}

extract_ticket_allowed_paths() {
  local file="$1"
  awk '
    /^## Allowed Paths/ { in_allowed=1; next }
    /^## / && in_allowed { in_allowed=0 }
    in_allowed && /^[[:space:]]*[-*] / {
      sub(/^[[:space:]]*[-*][[:space:]]+/, "", $0)
      gsub(/`/, "", $0)
      sub(/^[[:space:]]+/, "", $0)
      sub(/[[:space:]]+$/, "", $0)
      if ($0 != "" && $0 != "...") {
        print
      }
    }
  ' "$file"
}

ticket_retry_count() {
  local file="$1"
  local value

  value="$(extract_scalar_field_in_section "$file" "Retry" "Retry Count" | tr -cd '0-9')"
  if [ -z "$value" ]; then
    printf '0'
    return 0
  fi

  printf '%s' "$((10#$value))"
}

bump_ticket_retry_count() {
  local file="$1"
  local next_count max_retries

  next_count="$(( $(ticket_retry_count "$file") + 1 ))"
  max_retries="$(ticket_max_retries "$file")"
  replace_section_block "$file" "Retry" "- Retry Count: ${next_count}
- Max Retries: ${max_retries}"
  printf '%s' "$next_count"
}

append_reject_history_entry() {
  local file="$1"
  local entry="$2"
  local existing block

  existing="$(extract_section_text "$file" "Reject History" | sed '/^[[:space:]]*$/d')"
  if [ -n "$existing" ]; then
    block="${existing}
- ${entry}"
  else
    block="- ${entry}"
  fi

  replace_section_block "$file" "Reject History" "$block"
}

replan_reject_to_todo() {
  local reject_file="$1"
  local ticket_id target_file timestamp retry_count reject_reason verification_log reject_origin

  [ -f "$reject_file" ] || return 1

  ticket_id="$(extract_numeric_id "$reject_file")"
  target_file="$(ticket_path "todo" "$ticket_id")"
  if [ -e "$target_file" ] && [ "$target_file" != "$reject_file" ]; then
    return 1
  fi

  timestamp="$(now_iso)"
  reject_origin="$(board_relative_path "$reject_file")"
  verification_log="$(extract_scalar_field_in_section "$reject_file" "Verification" "Log file")"
  reject_reason="$(
    extract_section_text "$reject_file" "Reject Reason" \
      | sed -E 's/^[[:space:]]*-[[:space:]]*//' \
      | sed '/^[[:space:]]*$/d' \
      | tr '\n' ' ' \
      | sed 's/[[:space:]]\+/ /g; s/[[:space:]]*$//'
  )"
  if [ -z "$reject_reason" ]; then
    reject_reason="No recorded reject reason."
  fi

  retry_count="$(bump_ticket_retry_count "$reject_file")"
  append_reject_history_entry \
    "$reject_file" \
    "${timestamp} | retry_count=${retry_count} | source=\`${reject_origin}\` | log=\`${verification_log:-pending}\` | reason=${reject_reason}"

  replace_scalar_field_in_section "$reject_file" "## Ticket" "Stage" "todo"
  replace_scalar_field_in_section "$reject_file" "## Ticket" "AI" ""
  replace_scalar_field_in_section "$reject_file" "## Ticket" "Claimed By" ""
  replace_scalar_field_in_section "$reject_file" "## Ticket" "Execution AI" ""
  replace_scalar_field_in_section "$reject_file" "## Ticket" "Verifier AI" ""
  replace_scalar_field_in_section "$reject_file" "## Ticket" "Last Updated" "$timestamp"
  replace_section_block "$reject_file" "Worktree" "- Path:
- Branch:
- Base Commit:
- Worktree Commit:
- Integration Status: pending_claim"
  replace_section_block "$reject_file" "Next Action" "- 다음에 바로 이어서 할 일: 가장 최근 Reject History 를 반영해 mini-plan 을 다시 적고 구현을 재개한다."
  replace_section_block "$reject_file" "Verification" "- Run file:
- Log file:
- Result: pending"
  replace_section_block "$reject_file" "Result" "- Summary:
- Remaining risk:"
  append_note "$reject_file" "Ticket automatically replanned from ${reject_origin} at ${timestamp}; retry_count=${retry_count}"

  mkdir -p "$(dirname "$target_file")"
  if [ "$reject_file" != "$target_file" ]; then
    mv "$reject_file" "$target_file"
  fi

  printf '%s' "$target_file"
}

auto_recover_blocked_ticket() {
  local ticket_file="$1"
  local stage worktree_branch worktree_path git_root holder_path conflict_branch timestamp
  local shared_blockers latest_runtime_event

  [ -f "$ticket_file" ] || return 1
  stage="$(ticket_stage "$ticket_file")"
  [ "$stage" = "blocked" ] || return 1

  timestamp="$(now_iso)"
  shared_blockers="$(ticket_shared_allowed_path_blockers "$ticket_file" || true)"
  if [ -n "$shared_blockers" ]; then
    return 1
  fi
  latest_runtime_event="$(ticket_latest_runtime_block_event "$ticket_file" || true)"

  if [ "$latest_runtime_event" = "runtime_shared_allowed" ]; then
    append_note "$ticket_file" "Auto-recovery at ${timestamp}: shared Allowed Path blockers cleared; retrying claim"
  elif [ -z "$latest_runtime_event" ] && grep -Fq "worktree setup failed" "$ticket_file"; then
    :
  elif [ "${AUTOFLOW_OWNER_AUTO_RECOVER_BLOCKED:-}" = "1" ]; then
    :
  else
    return 1
  fi

  worktree_branch="$(strip_markdown_code_ticks "$(ticket_worktree_field "$ticket_file" "Branch")")"

  git_root="$(git_root_path || true)"
  if [ -n "$git_root" ] && [ -n "$worktree_branch" ]; then
    holder_path="$(git -C "$git_root" worktree list --porcelain 2>/dev/null \
      | awk -v branch="refs/heads/${worktree_branch}" '
          /^worktree / { current=$2 }
          $0 == "branch " branch { print current; exit }
        ')"
    if [ -n "$holder_path" ] && [ "$holder_path" != "$git_root" ] && \
       (! [ -d "$holder_path" ] || [ "$holder_path" != "$(ticket_worktree_path_for_id "$(extract_numeric_id "$ticket_file")")" ]); then
      conflict_branch="stale-blocked/$(date -u '+%Y%m%dT%H%M%SZ')-${worktree_branch#autoflow/}"
      git -C "$git_root" branch -m "$worktree_branch" "$conflict_branch" 2>/dev/null || true
      append_note "$ticket_file" "Auto-recovery at ${timestamp}: renamed conflicting branch ${worktree_branch} -> ${conflict_branch} (held by ${holder_path})"
    fi
  fi

  replace_section_block "$ticket_file" "Worktree" "- Path:
- Branch:
- Base Commit:
- Worktree Commit:
- Integration Status: pending_claim"
  replace_scalar_field_in_section "$ticket_file" "## Ticket" "Stage" "executing"
  replace_scalar_field_in_section "$ticket_file" "## Ticket" "Last Updated" "$timestamp"
  append_note "$ticket_file" "Auto-recovery at ${timestamp}: cleared blocked worktree fields, retrying claim"
  return 0
}

ensure_ticket_worktree() {
  local ticket_file="$1"
  local ticket_id git_root base_commit branch worktree_path parent_root existing_path existing_branch fallback_reason

  if worktree_mode_disabled; then
    replace_section_block "$ticket_file" "Worktree" "- Path:
- Branch:
- Base Commit:
- Worktree Commit:
- Integration Status: disabled"
    printf 'worktree_status=disabled\n'
    return 0
  fi

  git_root="$(git_root_path || true)"
  if [ -z "$git_root" ]; then
    replace_section_block "$ticket_file" "Worktree" "- Path:
- Branch:
- Base Commit:
- Worktree Commit:
- Integration Status: not_git_repo"
    printf 'worktree_status=not_git_repo\n'
    return 0
  fi

  base_commit="$(git_head_commit "$git_root" || true)"
  if [ -z "$base_commit" ]; then
    replace_section_block "$ticket_file" "Worktree" "- Path:
- Branch:
- Base Commit:
- Worktree Commit:
- Integration Status: no_head_commit"
    printf 'worktree_status=no_head_commit\n'
    return 0
  fi

  fallback_reason="$(worktree_auto_fallback_reason "$ticket_file" "$git_root" || true)"
  if [ -n "$fallback_reason" ]; then
    replace_section_block "$ticket_file" "Worktree" "- Path:
- Branch:
- Base Commit: ${base_commit}
- Worktree Commit:
- Integration Status: project_root_fallback"
    printf 'worktree_status=project_root_fallback\n'
    printf 'worktree_fallback_reason=%s\n' "$fallback_reason"
    return 0
  fi

  ticket_id="$(extract_numeric_id "$ticket_file")"
  branch="$(ticket_worktree_branch_for_id "$ticket_id")"
  worktree_path="$(ticket_worktree_path_for_id "$ticket_id")"
  parent_root="$(dirname "$worktree_path")"
  mkdir -p "$parent_root"

  existing_path="$(ticket_worktree_path_from_file "$ticket_file")"
  if [ -n "$existing_path" ] && git -C "$existing_path" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    worktree_path="$existing_path"
    existing_branch="$(git -C "$worktree_path" symbolic-ref --short HEAD 2>/dev/null || true)"
    [ -n "$existing_branch" ] && branch="$existing_branch"
  elif git -C "$worktree_path" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    :
  elif git -C "$git_root" show-ref --verify --quiet "refs/heads/${branch}"; then
    git -C "$git_root" worktree add "$worktree_path" "$branch" >/dev/null
  else
    git -C "$git_root" worktree add -b "$branch" "$worktree_path" "$base_commit" >/dev/null
  fi

  replace_section_block "$ticket_file" "Worktree" "- Path: \`${worktree_path}\`
- Branch: ${branch}
- Base Commit: ${base_commit}
- Worktree Commit:
- Integration Status: pending"
  printf 'worktree_status=ready\n'
  printf 'worktree_path=%s\n' "$worktree_path"
  printf 'worktree_branch=%s\n' "$branch"
  printf 'worktree_base=%s\n' "$base_commit"
  hydrate_ticket_worktree_dependencies "$ticket_file" "$worktree_path"
}

stage_is_execution_candidate() {
  case "${1:-}" in
    ""|claimed|executing|blocked)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

stage_is_verification_candidate() {
  case "${1:-}" in
    ready_for_verification|verifying)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

strip_markdown_code_ticks() {
  local raw="${1:-}"
  raw="$(trim_spaces "$raw")"

  if printf '%s' "$raw" | grep -qE '^\[[^]]+\]\([^)]+\)$'; then
    raw="$(printf '%s' "$raw" | sed -E 's/^\[[^]]+\]\(([^)]+)\)$/\1/')"
  elif printf '%s' "$raw" | grep -qE '^\[\[[^]]+\]\]$'; then
    raw="$(printf '%s' "$raw" | sed -E 's/^\[\[([^]|]+)(\|[^]]+)?\]\]$/\1/')"
  else
    raw="${raw#\`}"
    raw="${raw%\`}"
  fi

  printf '%s' "$raw"
}

note_name_from_board_ref() {
  local rel="${1:-}"
  local normalized base_name

  normalized="$(strip_markdown_code_ticks "$rel")"
  normalized="${normalized##*/}"
  base_name="${normalized%.md}"
  printf '%s' "$base_name"
}

project_key_from_spec_ref() {
  local spec_ref="${1:-}"
  local note_name

  note_name="$(note_name_from_board_ref "$spec_ref")"
  if [ -n "$note_name" ]; then
    printf '%s' "$note_name"
    return 0
  fi

  printf 'unlinked-project'
}

project_key_from_ticket_file() {
  local ticket_file="$1"
  local project_key project_ref

  project_key="$(ticket_scalar_field "$ticket_file" "PRD Key")"
  project_key="$(trim_spaces "$project_key")"
  if [ -n "$project_key" ]; then
    printf '%s' "$project_key"
    return 0
  fi

  project_ref="$(extract_reference_value "$ticket_file" "References" "PRD")"
  printf '%s' "$(project_key_from_spec_ref "$project_ref")"
}

project_id_from_spec_ref() {
  local spec_ref="${1:-}"
  local note_name digits

  note_name="$(note_name_from_board_ref "$spec_ref")"
  digits="$(printf '%s' "$note_name" | sed -n 's/.*_\([0-9][0-9][0-9]\)$/\1/p')"
  printf '%s' "$digits"
}

plan_note_name_from_ticket_file() {
  local ticket_file="$1"
  local plan_ref

  plan_ref="$(extract_reference_value "$ticket_file" "References" "Plan Source")"
  note_name_from_board_ref "$plan_ref"
}

plan_id_from_ticket_file() {
  local ticket_file="$1"
  local plan_ref

  plan_ref="$(extract_reference_value "$ticket_file" "References" "Plan Source")"
  plan_id_from_ref "$plan_ref"
}

ticket_note_name_from_ticket_file() {
  local ticket_file="$1"
  local base_name ticket_id

  base_name="$(basename "$ticket_file" .md)"
  case "$base_name" in
    tickets_[0-9][0-9][0-9]|reject_[0-9][0-9][0-9])
      printf '%s' "$base_name"
      return 0
      ;;
  esac

  ticket_id="$(extract_numeric_id "$ticket_file")"
  printf 'tickets_%s' "$ticket_id"
}

verification_note_name_for_ticket() {
  local ticket_id="$1"
  printf 'verify_%s' "$ticket_id"
}

pending_run_path() {
  local ticket_id="$1"
  printf '%s/tickets/inprogress/verify_%s.md' "$BOARD_ROOT" "$ticket_id"
}

ready_to_merge_ticket_path_for_ticket_file() {
  # Post-refactor: tickets/ready-to-merge/ no longer exists. Tickets stay in
  # tickets/inprogress/ with Stage=ready_to_merge until merge-ready-ticket.sh
  # picks them up. Helper kept for back-compat with older scripts that may
  # still call it; returns the inprogress path.
  local ticket_file="$1"
  local ticket_id

  ticket_id="$(extract_numeric_id "$ticket_file")"
  printf '%s/tickets/inprogress/tickets_%s.md' "$BOARD_ROOT" "$ticket_id"
}

ready_to_merge_run_path_for_ticket_file() {
  local ticket_file="$1"
  local ticket_id

  ticket_id="$(extract_numeric_id "$ticket_file")"
  printf '%s/tickets/inprogress/verify_%s.md' "$BOARD_ROOT" "$ticket_id"
}

merge_blocked_ticket_path_for_ticket_file() {
  # Post-refactor: tickets/merge-blocked/ no longer exists. Tickets stay in
  # tickets/inprogress/ with Stage=merge_blocked. Helper returns the
  # inprogress path so legacy callers work unchanged.
  local ticket_file="$1"
  local ticket_id

  ticket_id="$(extract_numeric_id "$ticket_file")"
  printf '%s/tickets/inprogress/tickets_%s.md' "$BOARD_ROOT" "$ticket_id"
}

merge_blocked_run_path_for_ticket_file() {
  local ticket_file="$1"
  local ticket_id

  ticket_id="$(extract_numeric_id "$ticket_file")"
  printf '%s/tickets/inprogress/verify_%s.md' "$BOARD_ROOT" "$ticket_id"
}

done_dir_for_project_key() {
  local project_key="${1:-}"
  printf '%s/tickets/done/%s' "$BOARD_ROOT" "${project_key:-unlinked-project}"
}

done_plan_path_for_project_key() {
  local project_key="$1"
  local plan_id="$2"

  printf '%s/plan_%s.md' "$(done_dir_for_project_key "$project_key")" "$plan_id"
}

done_spec_path_for_spec_ref() {
  local spec_ref="$1"
  local project_key base_name

  project_key="$(project_key_from_spec_ref "$spec_ref")"
  base_name="$(basename "$(strip_markdown_code_ticks "$spec_ref")")"
  [ -n "$base_name" ] || return 1
  printf '%s/%s' "$(done_dir_for_project_key "$project_key")" "$base_name"
}

done_spec_ref_for_spec_ref() {
  local spec_ref="$1"
  local done_spec_file

  case "$(strip_markdown_code_ticks "$spec_ref")" in
    tickets/done/*)
      printf '%s' "$(strip_markdown_code_ticks "$spec_ref")"
      return 0
      ;;
  esac

  done_spec_file="$(done_spec_path_for_spec_ref "$spec_ref")"
  board_relative_path "$done_spec_file"
}

archive_spec_to_done_if_needed() {
  local spec_ref="$1"
  local normalized source_path target_path target_ref

  normalized="$(strip_markdown_code_ticks "$spec_ref")"
  [ -n "$normalized" ] || return 1

  case "$normalized" in
    tickets/done/*)
      printf '%s' "$normalized"
      return 0
      ;;
  esac

  source_path="${BOARD_ROOT}/${normalized}"
  target_path="$(done_spec_path_for_spec_ref "$normalized")"
  target_ref="$(board_relative_path "$target_path")"

  if [ -f "$target_path" ]; then
    if [ -f "$source_path" ] && cmp -s "$source_path" "$target_path"; then
      rm -f "$source_path"
    fi
    printf '%s' "$target_ref"
    return 0
  fi

  if [ -f "$source_path" ]; then
    mkdir -p "$(dirname "$target_path")"
    mv "$source_path" "$target_path"
  fi

  printf '%s' "$target_ref"
}

done_plan_path_for_ticket_file() {
  local ticket_file="$1"
  local plan_id project_key

  plan_id="$(plan_id_from_ticket_file "$ticket_file")"
  [ -n "$plan_id" ] || return 1
  project_key="$(project_key_from_ticket_file "$ticket_file")"
  done_plan_path_for_project_key "$project_key" "$plan_id"
}

done_ticket_path_for_ticket_file() {
  local ticket_file="$1"
  local ticket_id project_key

  ticket_id="$(extract_numeric_id "$ticket_file")"
  project_key="$(project_key_from_ticket_file "$ticket_file")"
  printf '%s/tickets_%s.md' "$(done_dir_for_project_key "$project_key")" "$ticket_id"
}

reject_ticket_path_for_ticket_file() {
  local ticket_file="$1"
  local ticket_id

  ticket_id="$(extract_numeric_id "$ticket_file")"
  printf '%s/tickets/reject/reject_%s.md' "$BOARD_ROOT" "$ticket_id"
}

done_reject_path_for_reject_file() {
  local reject_file="$1"
  local reject_id project_key

  reject_id="$(extract_numeric_id "$reject_file")"
  project_key="$(project_key_from_ticket_file "$reject_file")"
  printf '%s/reject_%s.md' "$(done_dir_for_project_key "$project_key")" "$reject_id"
}

archive_reject_file_to_done() {
  local reject_file="$1"
  local reject_id target_file target_run_file source_run_file timestamp timestamp_slug

  [ -f "$reject_file" ] || return 1

  reject_id="$(extract_numeric_id "$reject_file")"
  target_file="$(done_reject_path_for_reject_file "$reject_file")"
  source_run_file="${BOARD_ROOT}/tickets/reject/verify_${reject_id}.md"
  target_run_file="$(done_run_path_for_ticket_file "$reject_file")"
  timestamp="$(now_iso)"
  timestamp_slug="$(printf '%s' "$timestamp" | tr -d ':-')"

  mkdir -p "$(dirname "$target_file")"
  replace_scalar_field_in_section "$reject_file" "## Ticket" "Stage" "replanned"
  replace_scalar_field_in_section "$reject_file" "## Ticket" "Last Updated" "$timestamp"

  if [ -f "$source_run_file" ]; then
    mkdir -p "$(dirname "$target_run_file")"
    replace_literal_in_file_runtime "$reject_file" "$(board_relative_path "$source_run_file")" "$(board_relative_path "$target_run_file")" || true
    if [ "$source_run_file" != "$target_run_file" ]; then
      if [ -f "$target_run_file" ]; then
        if cmp -s "$source_run_file" "$target_run_file"; then
          rm -f "$source_run_file"
        else
          target_run_file="${target_run_file%.md}.${timestamp_slug}.duplicate.md"
          mv "$source_run_file" "$target_run_file"
        fi
      else
        mv "$source_run_file" "$target_run_file"
      fi
    fi
  fi

  append_note "$reject_file" "Archived to done after planner created or found a retry candidate at ${timestamp}"

  if [ "$reject_file" != "$target_file" ]; then
    if [ -f "$target_file" ]; then
      if cmp -s "$reject_file" "$target_file"; then
        rm -f "$reject_file"
      else
        target_file="${target_file%.md}.${timestamp_slug}.duplicate.md"
        mv "$reject_file" "$target_file"
      fi
    else
      mv "$reject_file" "$target_file"
    fi
  fi

  printf '%s' "$target_file"
}

archive_orphan_reject_runs() {
  local run_file run_id project_key target_run_file timestamp_slug done_reject_file old_ref new_ref

  [ -d "${BOARD_ROOT}/tickets/reject" ] || return 0

  while IFS= read -r run_file; do
    [ -n "$run_file" ] || continue
    run_id="$(extract_numeric_id "$run_file")"

    if [ -f "${BOARD_ROOT}/tickets/reject/reject_${run_id}.md" ] || [ -f "${BOARD_ROOT}/tickets/reject/tickets_${run_id}.md" ]; then
      continue
    fi

    project_key="$(extract_scalar_field_in_section "$run_file" "Meta" "PRD Key")"
    if [ -z "$project_key" ]; then
      continue
    fi

    target_run_file="$(done_dir_for_project_key "$project_key")/verify_${run_id}.md"
    mkdir -p "$(dirname "$target_run_file")"
    if [ -f "$target_run_file" ]; then
      if cmp -s "$run_file" "$target_run_file"; then
        rm -f "$run_file"
      else
        timestamp_slug="$(printf '%s' "$(now_iso)" | tr -d ':-')"
        target_run_file="${target_run_file%.md}.${timestamp_slug}.duplicate.md"
        mv "$run_file" "$target_run_file"
      fi
    else
      mv "$run_file" "$target_run_file"
    fi
    done_reject_file="$(done_dir_for_project_key "$project_key")/reject_${run_id}.md"
    if [ -f "$done_reject_file" ]; then
      old_ref="tickets/reject/verify_${run_id}.md"
      new_ref="$(board_relative_path "$target_run_file")"
      replace_literal_in_file_runtime "$done_reject_file" "$old_ref" "$new_ref" || true
    fi
    printf 'archived_orphan_reject_run=%s\n' "$target_run_file"
  done < <(list_matching_files "${BOARD_ROOT}/tickets/reject" 'verify_[0-9][0-9][0-9].md')
}

done_run_path_for_ticket_file() {
  local ticket_file="$1"
  local ticket_id project_key

  ticket_id="$(extract_numeric_id "$ticket_file")"
  project_key="$(project_key_from_ticket_file "$ticket_file")"
  printf '%s/verify_%s.md' "$(done_dir_for_project_key "$project_key")" "$ticket_id"
}

reject_run_path_for_ticket_file() {
  local ticket_file="$1"
  local ticket_id

  ticket_id="$(extract_numeric_id "$ticket_file")"
  printf '%s/tickets/reject/verify_%s.md' "$BOARD_ROOT" "$ticket_id"
}

final_run_path_for_ticket_file() {
  local ticket_file="$1"
  local outcome="$2"

  case "$outcome" in
    pass)
      done_run_path_for_ticket_file "$ticket_file"
      ;;
    fail)
      reject_run_path_for_ticket_file "$ticket_file"
      ;;
    *)
      pending_run_path "$(extract_numeric_id "$ticket_file")"
      ;;
  esac
}

board_file_exists() {
  local rel="${1:-}"
  [ -n "$rel" ] || return 1
  [ -f "${BOARD_ROOT}/${rel}" ]
}

replace_literal_in_file_runtime() {
  local file="$1"
  local before="$2"
  local after="$3"
  local tmp before_escaped after_escaped

  [ -f "$file" ] || return 1
  before_escaped="$(printf '%s' "$before" | sed 's/[\/&]/\\&/g')"
  after_escaped="$(printf '%s' "$after" | sed 's/[\/&]/\\&/g')"
  tmp="$(autoflow_mktemp)"
  sed "s/${before_escaped}/${after_escaped}/g" "$file" > "$tmp"
  if cmp -s "$tmp" "$file"; then
    rm -f "$tmp"
    return 1
  fi
  mv "$tmp" "$file"
  return 0
}

ticket_belongs_to_plan_id() {
  local ticket_file="$1"
  local wanted_plan_id="$2"
  local current_plan_id

  current_plan_id="$(plan_id_from_ticket_file "$ticket_file")"
  [ -n "$current_plan_id" ] && [ "$current_plan_id" = "$wanted_plan_id" ]
}

plan_has_open_tickets() {
  local plan_id="$1"
  local ticket_root ticket_file

  for ticket_root in "${BOARD_ROOT}/tickets/todo" "${BOARD_ROOT}/tickets/inprogress" "${BOARD_ROOT}/tickets/verifier" "${BOARD_ROOT}/tickets/reject"; do
    [ -d "$ticket_root" ] || continue
    while IFS= read -r ticket_file; do
      [ -n "$ticket_file" ] || continue
      if ticket_belongs_to_plan_id "$ticket_file" "$plan_id"; then
        return 0
      fi
    done < <(list_ticket_record_files_under "$ticket_root")
  done

  return 1
}

plan_has_done_tickets() {
  local plan_id="$1"
  local ticket_file

  [ -d "${BOARD_ROOT}/tickets/done" ] || return 1
  while IFS= read -r ticket_file; do
    [ -n "$ticket_file" ] || continue
    if ticket_belongs_to_plan_id "$ticket_file" "$plan_id"; then
      return 0
    fi
  done < <(find "${BOARD_ROOT}/tickets/done" -type f -name 'tickets_*.md' | sort)

  return 1
}

update_ticket_plan_source_refs() {
  local plan_id="$1"
  local old_ref="$2"
  local new_ref="$3"
  local ticket_file

  while IFS= read -r ticket_file; do
    [ -n "$ticket_file" ] || continue
    if ticket_belongs_to_plan_id "$ticket_file" "$plan_id"; then
      replace_literal_in_file_runtime "$ticket_file" "\`${old_ref}\`" "\`${new_ref}\`" || true
    fi
  done < <(list_ticket_record_files_under "${BOARD_ROOT}/tickets")
}

archive_replanned_rejects_for_plan() {
  local plan_id="$1"
  local reject_file target_file old_ref new_ref

  while IFS= read -r reject_file; do
    [ -n "$reject_file" ] || continue
    if ! ticket_belongs_to_plan_id "$reject_file" "$plan_id"; then
      continue
    fi

    old_ref="$(board_relative_path "$reject_file")"
    target_file="$(archive_reject_file_to_done "$reject_file")"
    new_ref="$(board_relative_path "$target_file")"

    update_ticket_plan_source_refs "$plan_id" "$old_ref" "$new_ref"
    printf 'archived_reject=%s\n' "$target_file"
  done < <(list_reject_ticket_files)
}

archive_ticketed_plan_file() {
  local plan_file="$1"
  local project_key="$2"
  local plan_id done_plan_file old_ref root_ref new_ref

  [ -f "$plan_file" ] || return 1
  plan_id="$(extract_numeric_id "$plan_file")"
  done_plan_file="$(done_plan_path_for_project_key "$project_key" "$plan_id")"
  mkdir -p "$(dirname "$done_plan_file")"
  replace_scalar_field_in_section "$plan_file" "## Plan" "Status" "done"
  old_ref="$(board_relative_path "$plan_file")"
  new_ref="$(board_relative_path "$done_plan_file")"

  if [ "$plan_file" != "$done_plan_file" ]; then
    mv "$plan_file" "$done_plan_file"
  fi

  update_ticket_plan_source_refs "$plan_id" "$old_ref" "$new_ref"
  root_ref="tickets/plan/plan_${plan_id}.md"
  if [ "$root_ref" != "$old_ref" ]; then
    update_ticket_plan_source_refs "$plan_id" "$root_ref" "$new_ref"
  fi
  printf '%s' "$done_plan_file"
}

archive_completed_plan_for_ticket_file() {
  local ticket_file="$1"
  local plan_ref plan_id plan_file done_plan_file old_ref new_ref

  plan_ref="$(strip_markdown_code_ticks "$(extract_reference_value "$ticket_file" "References" "Plan Source")")"
  plan_id="$(plan_id_from_ref "$plan_ref")"
  if [ -z "$plan_id" ]; then
    printf 'plan_archive_status=no_plan_ref\n'
    return 0
  fi

  case "$plan_ref" in
    tickets/done/*)
      printf 'plan_archive_status=already_archived\n'
      printf 'plan_archive_target=%s\n' "$plan_ref"
      return 0
      ;;
  esac

  plan_file="${BOARD_ROOT}/${plan_ref}"
  if [ ! -f "$plan_file" ]; then
    plan_file="$(plan_path "$plan_id")"
  fi

  if [ ! -f "$plan_file" ]; then
    printf 'plan_archive_status=missing_plan\n'
    printf 'plan_id=%s\n' "$plan_id"
    return 0
  fi

  if plan_has_open_tickets "$plan_id"; then
    printf 'plan_archive_status=open_tickets_remaining\n'
    printf 'plan_id=%s\n' "$plan_id"
    return 0
  fi

  if ! plan_has_done_tickets "$plan_id"; then
    printf 'plan_archive_status=no_done_tickets\n'
    printf 'plan_id=%s\n' "$plan_id"
    return 0
  fi

  done_plan_file="$(done_plan_path_for_ticket_file "$ticket_file")"
  mkdir -p "$(dirname "$done_plan_file")"
  replace_scalar_field_in_section "$plan_file" "## Plan" "Status" "done"
  old_ref="$(board_relative_path "$plan_file")"
  new_ref="$(board_relative_path "$done_plan_file")"

  if [ "$plan_file" != "$done_plan_file" ]; then
    mv "$plan_file" "$done_plan_file"
  fi

  update_ticket_plan_source_refs "$plan_id" "$old_ref" "$new_ref"

  printf 'plan_archive_status=archived\n'
  printf 'plan_archive_target=%s\n' "$new_ref"
}

ticket_exists_for_plan_candidate() {
  local plan_id="$1"
  local candidate="$2"
  local ticket
  while IFS= read -r ticket; do
    [ -n "$ticket" ] || continue
    if ticket_belongs_to_plan_id "$ticket" "$plan_id" && \
       grep -qsF -- "- Plan Candidate: ${candidate}" "$ticket"; then
      return 0
    fi
  done < <(list_ticket_record_files_under "${BOARD_ROOT}/tickets")
  return 1
}

ensure_runs_file() {
  local ticket_id="$1"
  local file
  local template_file

  file="$(pending_run_path "$ticket_id")"
  if [ ! -f "$file" ]; then
    mkdir -p "${BOARD_ROOT}/tickets/inprogress"
    template_file="${BOARD_ROOT}/rules/verifier/verification-template.md"
    if [ ! -f "$template_file" ]; then
      template_file="${BOARD_ROOT}/verifier/templates/verification-template.md"
    fi
    if [ ! -f "$template_file" ]; then
      template_file="${BOARD_ROOT}/runs/verification-template.md"
    fi
    cp "$template_file" "$file"
    replace_scalar_field_in_section "$file" "## Meta" "Ticket ID" "$ticket_id"
    replace_scalar_field_in_section "$file" "## Meta" "Target" "tickets_${ticket_id}.md"
    replace_scalar_field_in_section "$file" "## Meta" "Status" "pending"
  fi
  printf '%s' "$file"
}

count_execution_load_for_owner() {
  local wanted_owner="$1"
  local count=0
  local file stage execution_owner

  while IFS= read -r file; do
    [ -n "$file" ] || continue
    execution_owner="$(ticket_scalar_field "$file" "Execution AI")"
    [ "$execution_owner" = "$wanted_owner" ] || continue
    stage="$(ticket_stage "$file")"
    if stage_is_execution_candidate "$stage"; then
      count=$((count + 1))
    fi
  done < <(list_matching_files "${BOARD_ROOT}/tickets/inprogress" 'tickets_*.md')

  printf '%s' "$count"
}

count_verification_load_for_owner() {
  local wanted_owner="$1"
  local count=0
  local file stage verifier_owner

  while IFS= read -r file; do
    [ -n "$file" ] || continue
    verifier_owner="$(ticket_scalar_field "$file" "Verifier AI")"
    [ "$verifier_owner" = "$wanted_owner" ] || continue
    stage="$(ticket_stage "$file")"
    case "${stage:-}" in
      ""|claimed|executing|ready_for_verification|verifying|blocked)
      count=$((count + 1))
      ;;
    esac
  done < <(list_matching_files "${BOARD_ROOT}/tickets/inprogress" 'tickets_*.md')

  printf '%s' "$count"
}

pick_least_loaded_owner() {
  local owner_kind="$1"
  local pool_csv="$2"
  local best_owner=""
  local best_count=""
  local candidate trimmed count
  local IFS=','
  local pool_entries=()

  read -r -a pool_entries <<< "$pool_csv"
  for candidate in "${pool_entries[@]}"; do
    trimmed="$(trim_spaces "$candidate")"
    [ -n "$trimmed" ] || continue
    if [ "$owner_kind" = "execution" ]; then
      count="$(count_execution_load_for_owner "$trimmed")"
    else
      count="$(count_verification_load_for_owner "$trimmed")"
    fi

    if [ -z "$best_owner" ] || [ "$count" -lt "$best_count" ]; then
      best_owner="$trimmed"
      best_count="$count"
    fi
  done

  printf '%s' "$best_owner"
}

resolve_execution_owner_for_claim() {
  local selected_owner=""

  if [ -n "${AUTOFLOW_EXECUTION_OWNER:-}" ]; then
    selected_owner="$(trim_spaces "${AUTOFLOW_EXECUTION_OWNER}")"
  elif [ -n "${AUTOFLOW_EXECUTION_POOL:-}" ]; then
    selected_owner="$(pick_least_loaded_owner "execution" "${AUTOFLOW_EXECUTION_POOL}")"
  fi

  if [ -z "$selected_owner" ]; then
    selected_owner="unassigned"
  fi

  printf '%s' "$selected_owner"
}

execution_load_limit() {
  printf '%s' "${AUTOFLOW_MAX_EXECUTION_LOAD_PER_WORKER:-1}"
}

execution_pool_has_capacity() {
  local limit pool_csv candidate trimmed count
  local IFS=','
  local pool_entries=()

  pool_csv="${AUTOFLOW_EXECUTION_POOL:-}"
  if [ -z "$pool_csv" ]; then
    return 0
  fi

  limit="$(execution_load_limit)"
  read -r -a pool_entries <<< "$pool_csv"
  for candidate in "${pool_entries[@]}"; do
    trimmed="$(trim_spaces "$candidate")"
    [ -n "$trimmed" ] || continue
    count="$(count_execution_load_for_owner "$trimmed")"
    if [ "$count" -lt "$limit" ]; then
      return 0
    fi
  done

  return 1
}

resolve_verifier_owner_for_claim() {
  local selected_owner=""

  if [ -n "${AUTOFLOW_VERIFIER_OWNER:-}" ]; then
    selected_owner="$(trim_spaces "${AUTOFLOW_VERIFIER_OWNER}")"
  elif [ -n "${AUTOFLOW_VERIFIER_POOL:-}" ]; then
    selected_owner="$(pick_least_loaded_owner "verification" "${AUTOFLOW_VERIFIER_POOL}")"
  fi

  if [ -z "$selected_owner" ]; then
    selected_owner="unassigned"
  fi

  printf '%s' "$selected_owner"
}
