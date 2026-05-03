#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/cli-common.sh"
source "$(runtime_scripts_root)/runner-common.sh"

usage() {
  cat <<'EOF' >&2
Usage:
  wiki-project.sh update [project-root] [board-dir-name] [--dry-run]
  wiki-project.sh lint [project-root] [board-dir-name] [--semantic] [--runner RUNNER_ID]
  wiki-project.sh query [project-root] [board-dir-name] --term TEXT [--term TEXT]... [--limit N] [--no-tickets] [--no-snippets] [--no-handoffs] [--rag] [--synth] [--save-as SLUG] [--runner RUNNER_ID]
  wiki-project.sh ingest [project-root] [board-dir-name] <source-file> [--slug SLUG] [--no-summary] [--runner RUNNER_ID]
  wiki-project.sh retrofit-frontmatter [project-root] [board-dir-name] [--dry-run] [--page BOARD_RELATIVE_PATH] [--allow-adapter] [--runner RUNNER_ID]
  wiki-project.sh summarize-telemetry [project-root] [board-dir-name] --slug SLUG --window 7d|30d|all
  wiki-project.sh summarize-telemetry [project-root] [board-dir-name] --slug-set telemetry-default --window 7d|30d|all

Examples:
  wiki-project.sh update /path/to/project
  wiki-project.sh lint /path/to/project .autoflow --semantic
  wiki-project.sh query /path/to/project --term auth --term session --limit 5 --synth
  wiki-project.sh query /path/to/project --term wiki --term lint --synth --save-as wiki-lint-summary
  wiki-project.sh ingest /path/to/project .autoflow docs/source.md --slug source-doc
  wiki-project.sh retrofit-frontmatter /path/to/project .autoflow --dry-run
  wiki-project.sh summarize-telemetry /path/to/project .autoflow --slug-set telemetry-default --window 7d

Environment:
  AUTOFLOW_WIKI_LINT_PROMPT_BYTES    Byte cap for the semantic-lint adapter prompt (default 32768).
                                     When the assembled prompt would exceed this, pages are dropped
                                     from the tail and `semantic_truncated=true` plus
                                     `semantic_dropped_pages.<n>=...` are emitted.
  AUTOFLOW_WIKI_LINT_DEBUG_PROMPT_PATH
                                     When set, the assembled adapter prompt is copied to that path
                                     before the adapter is invoked. Used by verifiers to confirm
                                     only changed pages are included.
  AUTOFLOW_WIKI_INGEST_PROMPT_BYTES  Byte cap for the ingest adapter prompt (default 16384).
  AUTOFLOW_WIKI_INGEST_DEBUG_PROMPT_PATH
                                     When set, the assembled ingest prompt is copied to that path.
  AUTOFLOW_WIKI_RAG_CHUNK_LINES      Line count per chunk for `wiki query --rag` (default 32).
  AUTOFLOW_WIKI_RAG_CHUNK_OVERLAP    Overlapping line count between RAG chunks (default 6).
  AUTOFLOW_WIKI_RETROFIT_PROMPT_BYTES
                                     Byte cap for the optional retrofit-frontmatter adapter prompt
                                     when --allow-adapter is passed (default 4096). The default
                                     deterministic path never invokes an adapter.
EOF
}

relative_to_board() {
  local board_root="$1"
  local file="$2"

  case "$file" in
    "$board_root"/*)
      printf '%s' "${file#"$board_root"/}"
      ;;
    *)
      printf '%s' "$file"
      ;;
  esac
}

autoflow_cli_path() {
  local project_root="$1"
  local candidate

  candidate="${project_root}/bin/autoflow"
  if [ -x "$candidate" ]; then
    printf '%s\n' "$candidate"
    return 0
  fi

  candidate="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." 2>/dev/null && pwd)/bin/autoflow"
  if [ -x "$candidate" ]; then
    printf '%s\n' "$candidate"
    return 0
  fi

  if command -v autoflow >/dev/null 2>&1; then
    command -v autoflow
    return 0
  fi

  printf 'autoflow\n'
}

prepare_wiki_adapter_env() {
  local project_root="$1"
  local cli_path cli_dir login_path root candidate ver_dir

  cli_path="$(autoflow_cli_path "$project_root")"
  export AUTOFLOW_CLI="$cli_path"

  if [ -x "$cli_path" ]; then
    cli_dir="$(dirname "$cli_path")"
    case ":$PATH:" in
      *":$cli_dir:"*) ;;
      *)
        PATH="${cli_dir}:${PATH}"
        export PATH
        ;;
    esac
  fi

  login_path="$(bash -lc 'printf %s "$PATH"' 2>/dev/null || true)"
  if [ -n "$login_path" ]; then
    PATH="${PATH}:${login_path}"
  fi

  for root in "${HOME:-}" "${USERPROFILE:-}"; do
    [ -n "$root" ] || continue
    for candidate in \
      "$root/AppData/Roaming/npm" \
      "$root/AppData/Roaming/nvm/current" \
      "$root/.local/bin" \
      "$root/.npm-global/bin" \
      "$root/bin"; do
      [ -d "$candidate" ] || continue
      PATH="${PATH}:${candidate}"
    done

    if [ -d "$root/AppData/Roaming/nvm" ]; then
      while IFS= read -r ver_dir; do
        [ -d "$ver_dir" ] || continue
        PATH="${PATH}:${ver_dir}"
      done < <(find "$root/AppData/Roaming/nvm" -maxdepth 1 -type d -name 'v*' 2>/dev/null | sort -r)
    fi
  done

  export PATH
}

extract_md_field() {
  local file="$1"
  local field="$2"

  awk -v field="$field" '
    {
      line=$0
      gsub(/\r$/, "", line)
      prefix="- " field ":"
      if (index(line, prefix) == 1) {
        sub("^[-] " field ":[[:space:]]*", "", line)
        print line
        found=1
        exit
      }
      prefix=field ":"
      if (index(line, prefix) == 1) {
        sub("^" field ":[[:space:]]*", "", line)
        print line
        found=1
        exit
      }
    }
    END { exit(found ? 0 : 1) }
  ' "$file" 2>/dev/null || true
}

extract_result_summary() {
  local file="$1"

  awk '
    /^- Summary:[[:space:]]*/ {
      line=$0
      sub(/^- Summary:[[:space:]]*/, "", line)
      print line
      found=1
      exit
    }
    END { exit(found ? 0 : 1) }
  ' "$file" 2>/dev/null || true
}

collect_files() {
  local root="$1"
  local pattern="$2"
  local destination="$3"

  : > "$destination"
  if [ -d "$root" ]; then
    find "$root" -type f -name "$pattern" | sort > "$destination"
  fi
}

count_lines() {
  local file="$1"

  if [ ! -f "$file" ]; then
    printf '0'
    return 0
  fi

  wc -l < "$file" | tr -d '[:space:]'
}

require_cmd() {
  local cmd="$1"

  if ! command -v "$cmd" >/dev/null 2>&1; then
    printf 'error=missing_%s\n' "$cmd"
    return 1
  fi
}

write_ticket_list() {
  local board_root="$1"
  local tickets_file="$2"
  local limit="${3:-12}"
  local count=0
  local file id title summary rel

  if [ ! -s "$tickets_file" ]; then
    printf -- '- No completed tickets found.\n'
    return 0
  fi

  while IFS= read -r file; do
    [ -n "$file" ] || continue
    count="$((count + 1))"
    [ "$count" -le "$limit" ] || break

    id="$(extract_md_field "$file" "ID")"
    [ -n "$id" ] || id="$(basename "$file" .md)"
    title="$(extract_md_field "$file" "Title")"
    [ -n "$title" ] || title="$id"
    summary="$(extract_result_summary "$file")"
    rel="$(relative_to_board "$board_root" "$file")"

    if [ -n "$summary" ]; then
      printf -- '- `%s` - %s. %s Source: `%s`.\n' "$id" "$title" "$summary" "$rel"
    else
      printf -- '- `%s` - %s. Source: `%s`.\n' "$id" "$title" "$rel"
    fi
  done < "$tickets_file"
}

write_log_list() {
  local board_root="$1"
  local logs_file="$2"
  local limit="${3:-12}"
  local count=0
  local file rel title

  if [ ! -s "$logs_file" ]; then
    printf -- '- No verifier logs found.\n'
    return 0
  fi

  while IFS= read -r file; do
    [ -n "$file" ] || continue
    count="$((count + 1))"
    [ "$count" -le "$limit" ] || break

    rel="$(relative_to_board "$board_root" "$file")"
    title="$(awk 'NF { print; exit }' "$file" 2>/dev/null || true)"
    [ -n "$title" ] || title="$(basename "$file")"
    printf -- '- %s Source: `%s`.\n' "$title" "$rel"
  done < "$logs_file"
}

write_handoff_list() {
  local board_root="$1"
  local handoffs_file="$2"
  local limit="${3:-12}"
  local count=0
  local file rel title

  if [ ! -s "$handoffs_file" ]; then
    printf -- '- No conversation handoffs archived.\n'
    return 0
  fi

  while IFS= read -r file; do
    [ -n "$file" ] || continue
    count="$((count + 1))"
    [ "$count" -le "$limit" ] || break

    rel="$(relative_to_board "$board_root" "$file")"
    title="$(awk 'NF { print; exit }' "$file" 2>/dev/null || true)"
    title="${title#\# }"
    [ -n "$title" ] || title="$(basename "$file")"
    printf -- '- %s. Source: `%s`.\n' "$title" "$rel"
  done < "$handoffs_file"
}

write_reject_list() {
  local board_root="$1"
  local rejects_file="$2"
  local limit="${3:-12}"
  local count=0
  local file rel reason

  if [ ! -s "$rejects_file" ]; then
    printf -- '- No reject records.\n'
    return 0
  fi

  while IFS= read -r file; do
    [ -n "$file" ] || continue
    count="$((count + 1))"
    [ "$count" -le "$limit" ] || break

    rel="$(relative_to_board "$board_root" "$file")"
    reason="$(awk '/^- Reason:/ { sub(/^- Reason:[[:space:]]*/, ""); print; exit }' "$file" 2>/dev/null || true)"
    if [ -n "$reason" ]; then
      printf -- '- %s Reason: %s. Source: `%s`.\n' "$(basename "$file" .md)" "$reason" "$rel"
    else
      printf -- '- %s. Source: `%s`.\n' "$(basename "$file" .md)" "$rel"
    fi
  done < "$rejects_file"
}

replace_managed_section() {
  local file="$1"
  local section="$2"
  local body_file="$3"
  local default_file="$4"
  local begin="<!-- AUTOFLOW:BEGIN ${section} -->"
  local end="<!-- AUTOFLOW:END ${section} -->"
  local source_file
  local tmp

  source_file="$(autoflow_mktemp)"
  tmp="$(autoflow_mktemp)"

  if [ -f "$file" ]; then
    cp "$file" "$source_file"
  else
    cp "$default_file" "$source_file"
  fi

  awk -v begin="$begin" -v end="$end" -v body_file="$body_file" '
    BEGIN {
      while ((getline line < body_file) > 0) {
        body = body line "\n"
      }
      close(body_file)
    }
    $0 == begin {
      print
      printf "%s", body
      in_managed = 1
      replaced = 1
      next
    }
    $0 == end {
      in_managed = 0
      print
      next
    }
    !in_managed {
      print
    }
    END {
      if (!replaced) {
        print ""
        print begin
        printf "%s", body
        print end
      }
    }
  ' "$source_file" > "$tmp"

  if wiki_files_match_without_check_timestamps "$file" "$tmp"; then
    rm -f "$source_file" "$tmp"
    return 1
  fi

  mv "$tmp" "$file"
  rm -f "$source_file"
  return 0
}

wiki_files_match_without_check_timestamps() {
  local left="$1"
  local right="$2"
  local left_normalized right_normalized

  [ -f "$left" ] || return 1
  [ -f "$right" ] || return 1

  left_normalized="$(autoflow_mktemp)"
  right_normalized="$(autoflow_mktemp)"

  sed -E '/^- Last (updated|rebuilt): /d' "$left" > "$left_normalized"
  sed -E '/^- Last (updated|rebuilt): /d' "$right" > "$right_normalized"

  if cmp -s "$left_normalized" "$right_normalized"; then
    rm -f "$left_normalized" "$right_normalized"
    return 0
  fi

  rm -f "$left_normalized" "$right_normalized"
  return 1
}

write_wiki_baseline_history() {
  local board_root="$1"
  local wiki_root="$2"
  local status="$3"
  local timestamp="$4"
  local done_count="$5"
  local reject_count="$6"
  local log_count="$7"
  local handoff_count="$8"
  local changed_count="$9"
  local history_file="${board_root}/runners/state/wiki-baseline.history"

  mkdir -p "$(dirname "$history_file")"
  {
    printf -- '---\n'
    printf 'checked_at=%s\n' "$timestamp"
    printf 'status=%s\n' "$status"
    printf 'wiki_root=%s\n' "$wiki_root"
    printf 'changed_file_count=%s\n' "$changed_count"
    printf 'ticket_done_count=%s\n' "$done_count"
    printf 'reject_count=%s\n' "$reject_count"
    printf 'log_count=%s\n' "$log_count"
    printf 'handoff_count=%s\n' "$handoff_count"
  } >> "$history_file"
}

write_default_pages() {
  local index_default="$1"
  local log_default="$2"
  local overview_default="$3"

  cat > "$index_default" <<'EOF'
# Wiki Index

This index catalogs wiki pages maintained from Autoflow work.

## Core Pages

- [[project-overview]]
- [[log]]
EOF

  cat > "$log_default" <<'EOF'
# Wiki Log

This page contains a derived Autoflow work timeline.
EOF

  cat > "$overview_default" <<'EOF'
# Project Overview

## Summary

- This page is maintained from Autoflow specs, tickets, verification records, logs, and approved conversation summaries.
EOF
}

first_meaningful_title() {
  local file="$1"
  local title

  title="$(awk 'NF { print; exit }' "$file" 2>/dev/null || true)"
  title="${title#\#\# }"
  title="${title#\# }"
  title="$(printf '%s' "$title" | tr -d '\r')"
  printf '%s' "$title"
}

result_kind_from_path() {
  local rel="$1"

  case "$rel" in
    wiki/decisions/*) printf 'wiki-decision' ;;
    wiki/features/*) printf 'wiki-feature' ;;
    wiki/architecture/*) printf 'wiki-architecture' ;;
    wiki/learnings/*) printf 'wiki-learning' ;;
    wiki/*) printf 'wiki' ;;
    tickets/done/*reject_*.md) printf 'ticket-reject' ;;
    tickets/done/*) printf 'ticket-done' ;;
    tickets/reject/*) printf 'ticket-reject' ;;
    conversations/*) printf 'handoff' ;;
    logs/*) printf 'log' ;;
    *) printf 'other' ;;
  esac
}

trim_text() {
  local input="$1"
  input="${input#"${input%%[![:space:]]*}"}"
  input="${input%"${input##*[![:space:]]}"}"
  input="$(printf '%s' "$input" | tr -d '\r' | tr '\n' ' ')"
  if [ "${#input}" -gt 200 ]; then
    input="${input:0:197}..."
  fi
  printf '%s' "$input"
}

wiki_output_escape() {
  printf '%s' "$1" | tr '\r\n' ' ' | sed 's/[[:space:]]\+/ /g; s/^ //; s/ $//'
}

wiki_file_checksum() {
  local file="$1"

  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$file" | awk '{ print $1 }'
  elif command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$file" | awk '{ print $1 }'
  else
    cksum "$file" | awk '{ print $1 ":" $2 }'
  fi
}

wiki_query_rag_chunk_lines() {
  local chunk_lines="${AUTOFLOW_WIKI_RAG_CHUNK_LINES:-32}"

  if ! [[ "$chunk_lines" =~ ^[0-9]+$ ]] || [ "$chunk_lines" -lt 4 ]; then
    chunk_lines="32"
  fi

  printf '%s' "$chunk_lines"
}

wiki_query_rag_chunk_overlap() {
  local chunk_lines="$1"
  local overlap="${AUTOFLOW_WIKI_RAG_CHUNK_OVERLAP:-6}"

  if ! [[ "$overlap" =~ ^[0-9]+$ ]]; then
    overlap="6"
  fi
  if [ "$overlap" -ge "$chunk_lines" ]; then
    overlap="$((chunk_lines / 4))"
  fi

  printf '%s' "$overlap"
}

wiki_query_score_file() {
  local file="$1"
  local terms_file="$2"
  local file_score=0 hits term

  while IFS= read -r term; do
    [ -n "$term" ] || continue
    hits="$(grep -Fic -- "$term" "$file" 2>/dev/null || printf '0')"
    hits="${hits//[!0-9]/}"
    [ -n "$hits" ] || hits=0
    file_score=$((file_score + hits))
  done < "$terms_file"

  printf '%s' "$file_score"
}

wiki_query_score_chunks() {
  local candidates="$1"
  local terms_file="$2"
  local scores="$3"
  local chunk_lines="$4"
  local chunk_overlap="$5"
  local file line_count start end next_start chunk_file chunk_score

  while IFS= read -r file; do
    [ -n "$file" ] || continue
    line_count="$(awk 'END { print NR }' "$file" 2>/dev/null || printf '0')"
    line_count="${line_count//[!0-9]/}"
    [ -n "$line_count" ] || line_count=0
    [ "$line_count" -gt 0 ] || continue

    start=1
    while [ "$start" -le "$line_count" ]; do
      end="$((start + chunk_lines - 1))"
      if [ "$end" -gt "$line_count" ]; then
        end="$line_count"
      fi

      chunk_file="$(autoflow_mktemp)"
      sed -n "${start},${end}p" "$file" > "$chunk_file"
      chunk_score="$(wiki_query_score_file "$chunk_file" "$terms_file")"
      if [ "$chunk_score" -gt 0 ]; then
        printf '%s\t%s\t%s\t%s\t%s\n' "$chunk_score" "$file" "$start" "$end" "$chunk_file" >> "$scores"
      fi

      [ "$end" -ge "$line_count" ] && break
      next_start="$((end - chunk_overlap + 1))"
      if [ "$next_start" -le "$start" ]; then
        next_start="$((start + 1))"
      fi
      start="$next_start"
    done
  done < "$candidates"
}

hash_stream() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 | awk '{ print $1 }'
  elif command -v sha256sum >/dev/null 2>&1; then
    sha256sum | awk '{ print $1 }'
  else
    cksum | awk '{ print $1 ":" $2 }'
  fi
}

find_wiki_runner() {
  local board_root="$1"
  local explicit_runner_id="${2:-}"
  local config_path runner_block runner_id runner_role runner_enabled fallback_runner_id

  export AUTOFLOW_BOARD_ROOT="$board_root"
  config_path="$(runner_config_path)"
  [ -f "$config_path" ] || return 1

  if [ -n "$explicit_runner_id" ]; then
    runner_block="$(runner_config_block "$explicit_runner_id" "$config_path" 2>/dev/null || true)"
    [ -n "$runner_block" ] || return 1
    runner_role="$(printf '%s\n' "$runner_block" | awk -F= '$1 == "role" { print $2; exit }')"
    runner_enabled="$(printf '%s\n' "$runner_block" | awk -F= '$1 == "enabled" { print $2; exit }')"
    case "$runner_role" in
      wiki|wiki-maintainer|coordinator|coord|doctor|diagnose) ;;
      *) return 1 ;;
    esac
    [ "${runner_enabled:-true}" = "true" ] || return 1
    printf '%s' "$explicit_runner_id"
    return 0
  fi

  while IFS= read -r line; do
    case "$line" in
      runner_begin)
        runner_id=""
        runner_role=""
        runner_enabled="true"
        ;;
      id=*)
        runner_id="${line#id=}"
        ;;
      role=*)
        runner_role="${line#role=}"
        ;;
      enabled=*)
        runner_enabled="${line#enabled=}"
        ;;
      runner_end)
        case "$runner_role" in
          wiki|wiki-maintainer)
            if [ "$runner_enabled" = "true" ] && [ -n "$runner_id" ]; then
              printf '%s' "$runner_id"
              return 0
            fi
            ;;
          coordinator|coord|doctor|diagnose)
            if [ "$runner_enabled" = "true" ] && [ -n "$runner_id" ] && [ -z "${fallback_runner_id:-}" ]; then
              fallback_runner_id="$runner_id"
            fi
            ;;
        esac
        ;;
    esac
  done < <(runner_list_config "$config_path")

  if [ -n "${fallback_runner_id:-}" ]; then
    printf '%s' "$fallback_runner_id"
    return 0
  fi

  return 1
}

wiki_runner_field() {
  local board_root="$1"
  local runner_id="$2"
  local field="$3"

  export AUTOFLOW_BOARD_ROOT="$board_root"
  runner_config_field "$runner_id" "$field" "$(runner_config_path)" 2>/dev/null || true
}

run_wiki_adapter_prompt() {
  local project_root="$1"
  local board_root="$2"
  local runner_id="$3"
  local prompt_file="$4"
  local stdout_file="$5"
  local stderr_file="$6"
  local agent model reasoning command_value
  local cmd=()

  agent="$(wiki_runner_field "$board_root" "$runner_id" "agent")"
  model="$(wiki_runner_field "$board_root" "$runner_id" "model")"
  reasoning="$(wiki_runner_field "$board_root" "$runner_id" "reasoning")"
  command_value="$(wiki_runner_field "$board_root" "$runner_id" "command")"
  prepare_wiki_adapter_env "$project_root"

  case "${agent:-}" in
    ""|manual|shell)
      return 127
      ;;
  esac

  if [ -n "$command_value" ]; then
    AUTOFLOW_PROJECT_ROOT="$project_root" \
      AUTOFLOW_BOARD_ROOT="$board_root" \
      AUTOFLOW_PROMPT_FILE="$prompt_file" \
      bash -lc "$command_value" < "$prompt_file" > "$stdout_file" 2> "$stderr_file"
    return $?
  fi

  case "$agent" in
    codex)
      command -v codex >/dev/null 2>&1 || return 127
      cmd=(codex exec --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check -C "$project_root")
      [ -z "$model" ] || cmd+=(-m "$model")
      [ -z "$reasoning" ] || cmd+=(-c "model_reasoning_effort=\"${reasoning}\"")
      cmd+=(-)
      AUTOFLOW_PROJECT_ROOT="$project_root" AUTOFLOW_BOARD_ROOT="$board_root" "${cmd[@]}" < "$prompt_file" > "$stdout_file" 2> "$stderr_file"
      ;;
    claude)
      command -v claude >/dev/null 2>&1 || return 127
      cmd=(claude -p --dangerously-skip-permissions --permission-mode bypassPermissions --output-format text)
      [ -z "$model" ] || cmd+=(--model "$model")
      [ -z "$reasoning" ] || cmd+=(--effort "$reasoning")
      cmd+=("$(cat "$prompt_file")")
      AUTOFLOW_PROJECT_ROOT="$project_root" AUTOFLOW_BOARD_ROOT="$board_root" "${cmd[@]}" > "$stdout_file" 2> "$stderr_file"
      ;;
    opencode)
      command -v opencode >/dev/null 2>&1 || return 127
      cmd=(opencode run)
      [ -z "$model" ] || cmd+=(--model "$model")
      [ -z "$reasoning" ] || cmd+=(--variant "$reasoning")
      cmd+=("$(cat "$prompt_file")")
      AUTOFLOW_PROJECT_ROOT="$project_root" AUTOFLOW_BOARD_ROOT="$board_root" "${cmd[@]}" > "$stdout_file" 2> "$stderr_file"
      ;;
    gemini)
      command -v gemini >/dev/null 2>&1 || return 127
      cmd=(gemini --skip-trust --approval-mode auto_edit --prompt "$(cat "$prompt_file")")
      [ -z "$model" ] || cmd+=(--model "$model")
      AUTOFLOW_PROJECT_ROOT="$project_root" AUTOFLOW_BOARD_ROOT="$board_root" "${cmd[@]}" > "$stdout_file" 2> "$stderr_file"
      ;;
    *)
      return 127
      ;;
  esac
}

semantic_lint_fingerprint_path() {
  local board_root="$1"
  local runner_id="$2"

  mkdir -p "${board_root}/runners/state"
  printf '%s/runners/state/%s.semantic-lint.fingerprint' "$board_root" "$runner_id"
}

semantic_lint_pages_fingerprint() {
  local board_root="$1"
  local pages_file="$2"
  local page rel checksum

  while IFS= read -r page; do
    [ -n "$page" ] || continue
    rel="$(relative_to_board "$board_root" "$page")"
    checksum="$(wiki_file_checksum "$page")"
    printf '%s  %s\n' "$checksum" "$rel"
  done < "$pages_file" | hash_stream
}

semantic_lint_record_fingerprint() {
  local board_root="$1"
  local runner_id="$2"
  local fingerprint="$3"
  local path

  path="$(semantic_lint_fingerprint_path "$board_root" "$runner_id")"
  printf '%s\n' "$fingerprint" > "$path"
}

# Per-page semantic-lint fingerprint helpers.
#
# State layout: <board_root>/runners/state/<runner_id>.semantic-lint.pages.d/<safe_name>
#   where <safe_name> is the board-relative path with `/` replaced by `__`.
# Each file contains the page's sha256 sum at the time of the last successful adapter call.
# The whole-wiki fingerprint at semantic_lint_fingerprint_path is still the cheap fast-path
# check used to short-circuit unchanged ticks; the per-page state is consulted only when
# the whole-wiki fingerprint indicates change.

wiki_safe_filename() {
  local rel="$1"
  printf '%s' "$rel" | tr '/' '_' | tr ' ' '_'
}

semantic_lint_pages_state_dir() {
  local board_root="$1"
  local runner_id="$2"
  local dir

  dir="${board_root}/runners/state/${runner_id}.semantic-lint.pages.d"
  mkdir -p "$dir"
  printf '%s' "$dir"
}

# Emit board-relative paths of pages whose content sum differs from the recorded
# per-page fingerprint, plus pages with no recorded fingerprint at all (i.e. new pages).
semantic_lint_emit_changed_pages() {
  local board_root="$1"
  local runner_id="$2"
  local pages_file="$3"
  local state_dir page rel sum prev safe

  state_dir="$(semantic_lint_pages_state_dir "$board_root" "$runner_id")"
  while IFS= read -r page; do
    [ -n "$page" ] || continue
    rel="$(relative_to_board "$board_root" "$page")"
    sum="$(wiki_file_checksum "$page")"
    safe="$(wiki_safe_filename "$rel")"
    prev=""
    if [ -f "${state_dir}/${safe}" ]; then
      prev="$(cat "${state_dir}/${safe}" 2>/dev/null || true)"
    fi
    if [ "$sum" != "$prev" ]; then
      printf '%s\n' "$rel"
    fi
  done < "$pages_file"
}

# For each changed page (board-relative path), emit pages that link to it via a
# `[[wikilink]]`. Both bare-stem (`[[stem]]`) and path-style (`[[dir/stem]]`) link
# forms are matched, plus optional `|alias` and `#heading` suffixes. Output may
# include duplicates; callers should sort -u and exclude already-included pages.
semantic_lint_emit_neighbors() {
  local board_root="$1"
  local pages_file="$2"
  local changed_file="$3"
  local changed_rel changed_stem changed_stem_re page rel pattern

  while IFS= read -r changed_rel; do
    [ -n "$changed_rel" ] || continue
    changed_stem="$(basename "$changed_rel" .md)"
    # Escape regex metacharacters in the stem so we can use grep -E safely.
    changed_stem_re="$(printf '%s' "$changed_stem" | sed -e 's/[][\\.^$*+?(){}|/]/\\&/g')"
    pattern="\\[\\[([^][]*/)?${changed_stem_re}([|#][^]]*)?\\]\\]"
    while IFS= read -r page; do
      [ -n "$page" ] || continue
      rel="$(relative_to_board "$board_root" "$page")"
      [ "$rel" = "$changed_rel" ] && continue
      if grep -Eq "$pattern" "$page" 2>/dev/null; then
        printf '%s\n' "$rel"
      fi
    done < "$pages_file"
  done < "$changed_file"
}

# Save current per-page checksums so the next run can diff against them.
semantic_lint_record_per_page() {
  local board_root="$1"
  local runner_id="$2"
  local pages_file="$3"
  local state_dir page rel sum safe

  state_dir="$(semantic_lint_pages_state_dir "$board_root" "$runner_id")"
  while IFS= read -r page; do
    [ -n "$page" ] || continue
    rel="$(relative_to_board "$board_root" "$page")"
    sum="$(wiki_file_checksum "$page")"
    safe="$(wiki_safe_filename "$rel")"
    printf '%s\n' "$sum" > "${state_dir}/${safe}"
  done < "$pages_file"
}

run_query_synth() {
  local project_root="$1"
  local board_root="$2"
  local terms_file="$3"
  local synth_results_file="$4"
  local explicit_runner_id="${5:-}"
  local save_as_slug="${6:-}"
  local runner_id prompt_file stdout_file stderr_file adapter_exit
  local answer citations_file citations_count=0 line

  runner_id="$(find_wiki_runner "$board_root" "$explicit_runner_id" || true)"
  if [ -z "$runner_id" ]; then
    printf 'synth_status=skipped_no_adapter\n'
    return 0
  fi

  prompt_file="$(autoflow_mktemp)"
  stdout_file="$(autoflow_mktemp)"
  stderr_file="$(autoflow_mktemp)"
  citations_file="$(autoflow_mktemp)"

  {
    printf 'You answer Autoflow wiki queries using only the supplied search results.\n'
    printf 'Keep the exact output keys and format. Write natural-language values in Korean.\n'
    printf 'Return plain text with this exact format:\n'
    printf 'synth_answer=<one concise Korean answer line>\n'
    printf 'synth_citation.1=<board-relative path>\n'
    printf 'Add more synth_citation.N lines only for paths you actually used. Do not invent paths.\n\n'
    printf 'Query terms:\n'
    sed 's/^/- /' "$terms_file"
    printf '\nSearch results:\n'
    cat "$synth_results_file"
  } > "$prompt_file"

  set +e
  run_wiki_adapter_prompt "$project_root" "$board_root" "$runner_id" "$prompt_file" "$stdout_file" "$stderr_file"
  adapter_exit=$?
  set -e

  if [ "$adapter_exit" -eq 127 ]; then
    printf 'synth_status=skipped_no_adapter\n'
    return 0
  fi

  if [ "$adapter_exit" -ne 0 ]; then
    printf 'synth_status=failed\n'
    printf 'synth_runner=%s\n' "$runner_id"
    printf 'synth_exit_code=%s\n' "$adapter_exit"
    return 0
  fi

  answer="$(awk -F= '/^synth_answer=/ { sub(/^[^=]*=/, "", $0); print; exit }' "$stdout_file")"
  grep -E '^synth_citation\.[0-9]+=' "$stdout_file" > "$citations_file" || true
  citations_count="$(wc -l < "$citations_file" | tr -d '[:space:]')"

  printf 'synth_status=ok\n'
  printf 'synth_runner=%s\n' "$runner_id"
  printf 'synth_answer=%s\n' "$(wiki_output_escape "${answer:-근거 있는 답변을 생성하지 못했습니다.}")"
  while IFS= read -r line; do
    [ -n "$line" ] || continue
    printf '%s\n' "$line"
  done < "$citations_file"
  printf 'synth_citation_count=%s\n' "${citations_count:-0}"

  if [ -n "$save_as_slug" ]; then
    save_synth_answer "$board_root" "$save_as_slug" "$runner_id" "$terms_file" "$citations_file" "$answer"
  fi
}

# Persist a synth answer to wiki/answers/<slug>.md so explorations compound.
# On re-save, the file's `created:` field is preserved and `updated:` is refreshed.
save_synth_answer() {
  local board_root="$1"
  local slug="$2"
  local runner_id="$3"
  local terms_file="$4"
  local citations_file="$5"
  local answer="$6"
  local answers_dir answer_path now created_at terms_yaml citations_yaml citation_line citation_path

  case "$slug" in
    *[!A-Za-z0-9_-]*|"")
      printf 'synth_save_status=invalid_slug\n'
      printf 'synth_save_slug=%s\n' "$slug"
      return 0
      ;;
  esac

  answers_dir="${board_root}/wiki/answers"
  mkdir -p "$answers_dir"
  answer_path="${answers_dir}/${slug}.md"
  now="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  created_at="$now"
  if [ -f "$answer_path" ]; then
    local existing_created
    existing_created="$(awk '/^created:[[:space:]]*/ { sub(/^created:[[:space:]]*/, ""); print; exit }' "$answer_path" 2>/dev/null || true)"
    if [ -n "$existing_created" ]; then
      created_at="$existing_created"
    fi
  fi

  terms_yaml=""
  while IFS= read -r line; do
    [ -n "$line" ] || continue
    if [ -z "$terms_yaml" ]; then
      terms_yaml="  - \"$(printf '%s' "$line" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')\""
    else
      terms_yaml="${terms_yaml}"$'\n'"  - \"$(printf '%s' "$line" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')\""
    fi
  done < "$terms_file"

  citations_yaml=""
  while IFS= read -r citation_line; do
    [ -n "$citation_line" ] || continue
    citation_path="${citation_line#*=}"
    if [ -z "$citations_yaml" ]; then
      citations_yaml="  - \"$(printf '%s' "$citation_path" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')\""
    else
      citations_yaml="${citations_yaml}"$'\n'"  - \"$(printf '%s' "$citation_path" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')\""
    fi
  done < "$citations_file"

  {
    printf -- '---\n'
    printf 'kind: synth_answer\n'
    printf 'slug: %s\n' "$slug"
    printf 'runner: %s\n' "$runner_id"
    printf 'created: %s\n' "$created_at"
    printf 'updated: %s\n' "$now"
    printf 'terms:\n'
    if [ -n "$terms_yaml" ]; then
      printf '%s\n' "$terms_yaml"
    fi
    printf 'citations:\n'
    if [ -n "$citations_yaml" ]; then
      printf '%s\n' "$citations_yaml"
    fi
    printf -- '---\n\n'
    printf '# %s\n\n' "$slug"
    printf '## Answer\n\n'
    printf '%s\n\n' "${answer:-근거 있는 답변을 생성하지 못했습니다.}"
    printf '## Citations\n\n'
    if [ -s "$citations_file" ]; then
      while IFS= read -r citation_line; do
        [ -n "$citation_line" ] || continue
        citation_path="${citation_line#*=}"
        printf -- '- `%s`\n' "$citation_path"
      done < "$citations_file"
    else
      printf -- '- (no citations were returned by the adapter)\n'
    fi
    printf '\n## Source\n\n'
    printf -- '- Generated by `autoflow wiki query --synth --save-as %s`.\n' "$slug"
  } > "$answer_path"

  printf 'synth_save_status=ok\n'
  printf 'synth_save_slug=%s\n' "$slug"
  printf 'synth_save_path=%s\n' "$(relative_to_board "$board_root" "$answer_path")"
  printf 'synth_save_created=%s\n' "$created_at"
  printf 'synth_save_updated=%s\n' "$now"
}

wiki_yaml_escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

wiki_slug_from_source() {
  local source_file="$1"
  local base

  base="$(basename "$source_file")"
  base="${base%.*}"
  printf '%s' "$base" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -e 's/[^a-z0-9_-]/-/g' -e 's/--*/-/g' -e 's/^[-_]*//' -e 's/[-_]*$//'
}

wiki_validate_lower_slug() {
  case "${1:-}" in
    ""|*[!a-z0-9_-]*)
      return 1
      ;;
    *)
      return 0
      ;;
  esac
}

wiki_resolve_source_path() {
  local project_root="$1"
  local source_input="$2"
  local normalized

  normalized="$(normalize_input_path "$source_input")"
  case "$normalized" in
    /*|[A-Za-z]:[\\/]*)
      printf '%s' "$normalized"
      ;;
    *)
      printf '%s/%s' "$project_root" "$normalized"
      ;;
  esac
}

ingest_source_state_dir() {
  local board_root="$1"
  local runner_id="$2"
  local dir

  dir="${board_root}/runners/state/${runner_id}.ingest.sources.d"
  mkdir -p "$dir"
  printf '%s' "$dir"
}

extract_frontmatter_value() {
  local file="$1"
  local key="$2"

  awk -v key="$key" '
    NR == 1 && $0 != "---" { exit }
    NR > 1 && $0 == "---" { exit }
    NR > 1 {
      prefix = key ":"
      if (index($0, prefix) == 1) {
        sub("^" key ":[[:space:]]*", "", $0)
        print
        exit
      }
    }
  ' "$file" 2>/dev/null || true
}

wiki_yaml_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

wiki_tag_slug() {
  printf '%s' "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//'
}

wiki_title_from_slug() {
  local slug="$1"

  printf '%s' "$slug" | awk '
    BEGIN { FS = "-" }
    {
      out = ""
      for (i = 1; i <= NF; i++) {
        if ($i == "") {
          continue
        }
        word = toupper(substr($i, 1, 1)) substr($i, 2)
        out = out (out == "" ? "" : " ") word
      }
      print out
    }
  '
}

wiki_first_h1_title() {
  local file="$1"

  awk '
    {
      line = $0
      sub(/\r$/, "", line)
      if (line ~ /^#[[:space:]]+/) {
        sub(/^#[[:space:]]+/, "", line)
        print line
        found = 1
        exit
      }
    }
    END { exit(found ? 0 : 1) }
  ' "$file" 2>/dev/null || true
}

retrofit_kind_from_rel() {
  local rel="$1"

  case "$rel" in
    wiki/decisions/*) printf 'decision' ;;
    wiki/features/*) printf 'feature' ;;
    wiki/learnings/*) printf 'learning' ;;
    wiki/architecture/*) printf 'architecture' ;;
    *) return 1 ;;
  esac
}

retrofit_is_excluded_page() {
  local rel="$1"
  local base

  base="$(basename "$rel")"
  case "$base" in
    README.md|index.md|log.md|project-overview.md)
      return 0
      ;;
  esac

  case "$rel" in
    wiki/decisions/*.md|wiki/features/*.md|wiki/learnings/*.md|wiki/architecture/*.md)
      return 1
      ;;
    *)
      return 0
      ;;
  esac
}

retrofit_has_frontmatter() {
  local file="$1"
  local first_line

  first_line="$(awk 'NR == 1 { sub(/\r$/, ""); print; exit }' "$file" 2>/dev/null || true)"
  [ "$first_line" = "---" ]
}

retrofit_git_timestamp() {
  local project_root="$1"
  local repo_rel="$2"
  local mode="$3"
  local epoch

  if [ "$mode" = "created" ]; then
    epoch="$(git -C "$project_root" log --diff-filter=A --follow --reverse --format=%ct -- "$repo_rel" 2>/dev/null | awk 'NF { print; exit }' || true)"
  else
    epoch="$(git -C "$project_root" log -1 --format=%ct -- "$repo_rel" 2>/dev/null | awk 'NF { print; exit }' || true)"
  fi

  if [ -n "$epoch" ]; then
    date -u -r "$epoch" '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || true
  fi
}

retrofit_write_frontmatter_file() {
  local output_file="$1"
  local kind="$2"
  local slug="$3"
  local title="$4"
  local created="$5"
  local updated="$6"
  local tags_csv="$7"
  local tag

  {
    printf -- '---\n'
    printf 'kind: %s\n' "$kind"
    printf 'slug: %s\n' "$slug"
    printf 'title: "%s"\n' "$(wiki_yaml_escape "$title")"
    printf 'created: %s\n' "$created"
    printf 'updated: %s\n' "$updated"
    printf 'tags:\n'
    IFS=',' read -r -a tags_array <<< "$tags_csv"
    for tag in "${tags_array[@]}"; do
      [ -n "$tag" ] || continue
      printf '  - %s\n' "$tag"
    done
    printf -- '---\n'
  } > "$output_file"
}

retrofit_tags_csv() {
  local kind="$1"
  local slug="$2"
  local rel="$3"
  local tags_file tag dir path_part

  tags_file="$(autoflow_mktemp)"
  printf '%s\n' "$(wiki_tag_slug "$kind")" >> "$tags_file"
  printf '%s\n' "$(wiki_tag_slug "$slug")" >> "$tags_file"

  path_part="${rel#wiki/}"
  dir="$(dirname "$path_part")"
  if [ "$dir" != "." ]; then
    while [ -n "$dir" ] && [ "$dir" != "." ]; do
      printf '%s\n' "$(wiki_tag_slug "$(basename "$dir")")" >> "$tags_file"
      dir="$(dirname "$dir")"
    done
  fi

  awk 'NF && !seen[$0]++ { print }' "$tags_file" | paste -sd ',' -
}

retrofit_maybe_adapter_title_tags() {
  local project_root="$1"
  local board_root="$2"
  local runner_id="$3"
  local file="$4"
  local rel="$5"
  local title="$6"
  local tags_csv="$7"
  local prompt_file stdout_file stderr_file budget body_bytes adapter_exit line key value

  [ -n "$runner_id" ] || return 0

  budget="${AUTOFLOW_WIKI_RETROFIT_PROMPT_BYTES:-4096}"
  case "$budget" in
    ''|*[!0-9]*) budget="4096" ;;
  esac

  prompt_file="$(autoflow_mktemp)"
  stdout_file="$(autoflow_mktemp)"
  stderr_file="$(autoflow_mktemp)"
  body_bytes="$(autoflow_mktemp)"
  LC_ALL=C head -c "$budget" "$file" > "$body_bytes" 2>/dev/null || true

  {
    printf 'Suggest deterministic wiki frontmatter polish.\n'
    printf 'Return only optional key=value lines: title=<title>, tags=<comma-separated extra tags>.\n'
    printf 'Do not invent facts. At most three extra tags.\n\n'
    printf 'page=%s\n' "$rel"
    printf 'current_title=%s\n' "$title"
    printf 'current_tags=%s\n\n' "$tags_csv"
    printf 'Body excerpt:\n'
    cat "$body_bytes"
  } > "$prompt_file"

  set +e
  run_wiki_adapter_prompt "$project_root" "$board_root" "$runner_id" "$prompt_file" "$stdout_file" "$stderr_file"
  adapter_exit=$?
  set -e
  if [ "$adapter_exit" -ne 0 ]; then
    printf 'retrofit_adapter_status=skipped_or_failed\n'
    printf 'retrofit_adapter_exit_code=%s\n' "$adapter_exit"
    return 0
  fi

  while IFS= read -r line; do
    key="${line%%=*}"
    value="${line#*=}"
    case "$key" in
      title)
        [ -n "$value" ] && title="$value"
        ;;
      tags)
        [ -n "$value" ] && tags_csv="${tags_csv},$(printf '%s' "$value" | tr ',' '\n' | while IFS= read -r tag_value; do wiki_tag_slug "$tag_value"; printf '\n'; done | awk 'NF' | head -n 3 | paste -sd ',' -)"
        ;;
    esac
  done < "$stdout_file"

  tags_csv="$(printf '%s' "$tags_csv" | tr ',' '\n' | awk 'NF && !seen[$0]++ { print }' | paste -sd ',' -)"
  printf 'retrofit_adapter_status=ok\n'
  printf 'title=%s\n' "$title"
  printf 'tags=%s\n' "$tags_csv"
}

ingest_write_raw_source() {
  local board_root="$1"
  local source_file="$2"
  local source_input="$3"
  local slug="$4"
  local sha="$5"
  local raw_path="$6"
  local now="$7"
  local existing_sha existing_ingested tmp

  existing_sha=""
  existing_ingested="$now"
  if [ -f "$raw_path" ]; then
    existing_sha="$(extract_frontmatter_value "$raw_path" "sha256")"
    existing_ingested="$(extract_frontmatter_value "$raw_path" "ingested_at")"
    [ -n "$existing_ingested" ] || existing_ingested="$now"
  fi

  if [ -f "$raw_path" ] && [ "$existing_sha" = "$sha" ]; then
    printf 'ingest_status=skipped_unchanged_source\n'
    printf 'ingest_raw_path=%s\n' "$(relative_to_board "$board_root" "$raw_path")"
    return 0
  fi

  tmp="$(autoflow_mktemp)"
  {
    printf -- '---\n'
    printf 'kind: raw_source\n'
    printf 'slug: %s\n' "$slug"
    printf 'original_path: "%s"\n' "$(wiki_yaml_escape "$source_input")"
    printf 'ingested_at: %s\n' "$existing_ingested"
    printf 'updated_at: %s\n' "$now"
    printf 'sha256: %s\n' "$sha"
    printf -- '---\n\n'
    cat "$source_file"
  } > "$tmp"
  mv "$tmp" "$raw_path"

  if [ -n "$existing_sha" ]; then
    printf 'ingest_status=updated_source\n'
  else
    printf 'ingest_status=ok\n'
  fi
  printf 'ingest_raw_path=%s\n' "$(relative_to_board "$board_root" "$raw_path")"
}

ingest_append_source_index_entry() {
  local board_root="$1"
  local slug="$2"
  local title="$3"
  local index_file="${board_root}/wiki/index.md"
  local entry

  mkdir -p "$(dirname "$index_file")"
  [ -f "$index_file" ] || write_default_pages "$(autoflow_mktemp)" "$(autoflow_mktemp)" "$(autoflow_mktemp)"

  entry="- [[sources/${slug}]] (${title:-source summary})"
  if [ -f "$index_file" ] && grep -Fq "[[sources/${slug}]]" "$index_file"; then
    return 0
  fi

  {
    if [ -f "$index_file" ]; then
      cat "$index_file"
      printf '\n'
    else
      printf '# Wiki Index\n\n'
    fi
    if ! grep -Fq '## sources/' "$index_file" 2>/dev/null; then
      printf '## sources/\n\n'
    fi
    printf '%s\n' "$entry"
  } > "${index_file}.tmp"
  mv "${index_file}.tmp" "$index_file"
}

ingest_adapter_value() {
  local file="$1"
  local key="$2"

  awk -v key="$key" -F= '
    $1 == key {
      sub(/^[^=]*=/, "", $0)
      print
      exit
    }
  ' "$file" 2>/dev/null || true
}

ingest_yaml_names_for_prefix() {
  local file="$1"
  local prefix="$2"
  local default_value="$3"
  local found=0

  awk -F= -v prefix="$prefix" '
    index($1, prefix) == 1 && $1 ~ /\.name$/ {
      value=$0
      sub(/^[^=]*=/, "", value)
      if (value != "") print value
    }
  ' "$file" | while IFS= read -r value; do
    found=1
    printf '  - "%s"\n' "$(wiki_yaml_escape "$value")"
  done

  if [ "$found" -eq 0 ] && [ -n "$default_value" ]; then
    printf '  - "%s"\n' "$(wiki_yaml_escape "$default_value")"
  fi
}

ingest_markdown_list_for_prefix() {
  local file="$1"
  local prefix="$2"
  local empty_text="$3"
  local values_file

  values_file="$(autoflow_mktemp)"
  awk -F= -v prefix="$prefix" '
    index($1, prefix) == 1 && $1 ~ /\.name$/ {
      key=$1
      idx=key
      sub("^" prefix, "", idx)
      sub("\\.name$", "", idx)
      name=$0
      sub(/^[^=]*=/, "", name)
      names[idx]=name
    }
    index($1, prefix) == 1 && $1 ~ /\.kind$/ {
      key=$1
      idx=key
      sub("^" prefix, "", idx)
      sub("\\.kind$", "", idx)
      kind=$0
      sub(/^[^=]*=/, "", kind)
      kinds[idx]=kind
    }
    index($1, prefix) == 1 && $1 ~ /\.note$/ {
      key=$1
      idx=key
      sub("^" prefix, "", idx)
      sub("\\.note$", "", idx)
      note=$0
      sub(/^[^=]*=/, "", note)
      notes[idx]=note
    }
    END {
      for (idx in names) {
        line = "- " names[idx]
        if (kinds[idx] != "") line = line " (" kinds[idx] ")"
        if (notes[idx] != "") line = line ": " notes[idx]
        print line
      }
    }
  ' "$file" | sort -V > "$values_file"

  if [ -s "$values_file" ]; then
    cat "$values_file"
  else
    printf -- '- %s\n' "$empty_text"
  fi
}

ingest_write_summary() {
  local board_root="$1"
  local slug="$2"
  local raw_rel="$3"
  local summary_path="$4"
  local adapter_stdout="$5"
  local now="$6"
  local created_at title one_line summary tmp
  local summary_preexisting="false"

  created_at="$now"
  if [ -f "$summary_path" ]; then
    summary_preexisting="true"
    created_at="$(extract_frontmatter_value "$summary_path" "created")"
    [ -n "$created_at" ] || created_at="$now"
  fi

  title="$(ingest_adapter_value "$adapter_stdout" "source_title")"
  one_line="$(ingest_adapter_value "$adapter_stdout" "source_one_line")"
  summary="$(ingest_adapter_value "$adapter_stdout" "source_summary")"
  [ -n "$title" ] || title="$slug"
  [ -n "$one_line" ] || one_line="Summary for ${slug}."
  [ -n "$summary" ] || summary="No adapter summary was returned."

  tmp="$(autoflow_mktemp)"
  {
    printf -- '---\n'
    printf 'kind: source_summary\n'
    printf 'slug: %s\n' "$slug"
    printf 'created: %s\n' "$created_at"
    printf 'updated: %s\n' "$now"
    printf 'raw_source: "%s"\n' "$raw_rel"
    printf 'entities:\n'
    ingest_yaml_names_for_prefix "$adapter_stdout" "source_entity." ""
    printf 'concepts:\n'
    ingest_yaml_names_for_prefix "$adapter_stdout" "source_concept." ""
    printf -- '---\n\n'
    printf '# %s\n\n' "$title"
    printf '## One-liner\n\n%s\n\n' "$one_line"
    printf '## Summary\n\n%s\n\n' "$summary"
    printf '## Entities\n\n'
    ingest_markdown_list_for_prefix "$adapter_stdout" "source_entity." "No entities returned."
    printf '\n## Concepts\n\n'
    ingest_markdown_list_for_prefix "$adapter_stdout" "source_concept." "No concepts returned."
    printf '\n## Source\n\n'
    printf -- '- `%s`\n' "$raw_rel"
  } > "$tmp"
  mv "$tmp" "$summary_path"

  if [ "$summary_preexisting" = "false" ]; then
    ingest_append_source_index_entry "$board_root" "$slug" "$title"
  fi
}

run_ingest() {
  local project_root="$1"
  local board_dir_name="$2"
  local source_input="$3"
  local slug_input="$4"
  local no_summary="$5"
  local explicit_runner_id="${6:-}"
  local board_root wiki_root raw_root sources_root source_file slug sha now raw_path summary_path
  local raw_rel runner_id state_dir state_file previous_sha prompt_file stdout_file stderr_file
  local prompt_header_file body_budget budget prompt_bytes truncated_flag debug_path adapter_exit
  local summary_existed

  board_root="$(board_root_path "$project_root" "$board_dir_name")"
  wiki_root="${board_root}/wiki"
  raw_root="${board_root}/wiki-raw"
  sources_root="${wiki_root}/sources"

  if ! board_is_initialized "$board_root"; then
    printf 'status=blocked\n'
    printf 'reason=board_not_initialized\n'
    printf 'project_root=%s\n' "$project_root"
    printf 'board_root=%s\n' "$board_root"
    exit 0
  fi

  source_file="$(wiki_resolve_source_path "$project_root" "$source_input")"
  if [ ! -f "$source_file" ]; then
    printf 'status=blocked\n'
    printf 'ingest_status=source_not_found\n'
    printf 'source_file=%s\n' "$source_file"
    exit 1
  fi

  if [ -n "$slug_input" ]; then
    slug="$slug_input"
  else
    slug="$(wiki_slug_from_source "$source_file")"
  fi
  if ! wiki_validate_lower_slug "$slug"; then
    printf 'status=blocked\n'
    printf 'ingest_status=invalid_slug\n'
    printf 'ingest_slug=%s\n' "$slug"
    exit 1
  fi

  mkdir -p "$raw_root" "$sources_root"
  sha="$(wiki_file_checksum "$source_file")"
  now="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  raw_path="${raw_root}/${slug}.md"
  summary_path="${sources_root}/${slug}.md"
  summary_existed="false"
  [ -f "$summary_path" ] && summary_existed="true"

  printf 'status=ok\n'
  printf 'project_root=%s\n' "$project_root"
  printf 'board_root=%s\n' "$board_root"
  printf 'wiki_raw_root=%s\n' "$raw_root"
  printf 'wiki_sources_root=%s\n' "$sources_root"
  printf 'ingest_slug=%s\n' "$slug"
  printf 'ingest_sha256=%s\n' "$sha"

  ingest_write_raw_source "$board_root" "$source_file" "$source_input" "$slug" "$sha" "$raw_path" "$now"
  raw_rel="$(relative_to_board "$board_root" "$raw_path")"

  if [ "$no_summary" = "true" ]; then
    printf 'ingest_summary_status=skipped_no_summary_flag\n'
    return 0
  fi

  runner_id="$(find_wiki_runner "$board_root" "$explicit_runner_id" || true)"
  if [ -z "$runner_id" ]; then
    printf 'ingest_summary_status=skipped_no_adapter\n'
    return 0
  fi

  state_dir="$(ingest_source_state_dir "$board_root" "$runner_id")"
  state_file="${state_dir}/${slug}"
  previous_sha=""
  [ -f "$state_file" ] && previous_sha="$(cat "$state_file" 2>/dev/null || true)"
  if [ "$previous_sha" = "$sha" ] && [ -f "$summary_path" ]; then
    printf 'ingest_summary_status=skipped_unchanged\n'
    printf 'ingest_summary_path=%s\n' "$(relative_to_board "$board_root" "$summary_path")"
    printf 'ingest_runner=%s\n' "$runner_id"
    return 0
  fi

  prompt_file="$(autoflow_mktemp)"
  prompt_header_file="$(autoflow_mktemp)"
  stdout_file="$(autoflow_mktemp)"
  stderr_file="$(autoflow_mktemp)"

  {
    printf 'Summarize one Autoflow raw source for the project wiki.\n'
    printf 'Return plain text key=value lines only. Write natural-language values in Korean.\n'
    printf 'Required keys:\n'
    printf 'source_title=<short title>\n'
    printf 'source_one_line=<one concise line>\n'
    printf 'source_summary=<concise paragraph>\n'
    printf 'Optional repeated keys:\n'
    printf 'source_entity.1.name=<name>\nsource_entity.1.kind=<kind>\nsource_entity.1.note=<note>\n'
    printf 'source_concept.1.name=<name>\nsource_concept.1.note=<note>\n\n'
    printf 'Source slug: %s\nRaw citation: %s\n\nSource body:\n' "$slug" "$raw_rel"
  } > "$prompt_header_file"

  budget="${AUTOFLOW_WIKI_INGEST_PROMPT_BYTES:-16384}"
  case "$budget" in
    ''|*[!0-9]*) budget=16384 ;;
  esac
  cp "$prompt_header_file" "$prompt_file"
  body_budget=$((budget - $(wc -c < "$prompt_header_file" | tr -d '[:space:]') - 20))
  truncated_flag="false"
  if [ "$body_budget" -gt 0 ] && [ "$(wc -c < "$source_file" | tr -d '[:space:]')" -gt "$body_budget" ]; then
    head -c "$body_budget" "$source_file" >> "$prompt_file"
    printf '\n...[truncated]...\n' >> "$prompt_file"
    truncated_flag="true"
  elif [ "$body_budget" -gt 0 ]; then
    cat "$source_file" >> "$prompt_file"
  fi
  if [ "$(wc -c < "$prompt_file" | tr -d '[:space:]')" -gt "$budget" ]; then
    head -c "$budget" "$prompt_file" > "${prompt_file}.cap"
    mv "${prompt_file}.cap" "$prompt_file"
    truncated_flag="true"
  fi
  prompt_bytes="$(wc -c < "$prompt_file" | tr -d '[:space:]')"

  debug_path="${AUTOFLOW_WIKI_INGEST_DEBUG_PROMPT_PATH:-}"
  if [ -n "$debug_path" ]; then
    mkdir -p "$(dirname "$debug_path")" 2>/dev/null || true
    cp "$prompt_file" "$debug_path" 2>/dev/null || true
  fi

  set +e
  run_wiki_adapter_prompt "$project_root" "$board_root" "$runner_id" "$prompt_file" "$stdout_file" "$stderr_file"
  adapter_exit=$?
  set -e

  printf 'ingest_runner=%s\n' "$runner_id"
  printf 'ingest_prompt_bytes=%s\n' "$prompt_bytes"
  printf 'ingest_prompt_budget=%s\n' "$budget"
  printf 'ingest_body_truncated=%s\n' "$truncated_flag"

  if [ "$adapter_exit" -eq 127 ]; then
    printf 'ingest_summary_status=skipped_no_adapter\n'
    return 0
  fi
  if [ "$adapter_exit" -ne 0 ]; then
    printf 'ingest_summary_status=failed\n'
    printf 'ingest_summary_exit_code=%s\n' "$adapter_exit"
    return 0
  fi

  ingest_write_summary "$board_root" "$slug" "$raw_rel" "$summary_path" "$stdout_file" "$now"
  printf '%s\n' "$sha" > "$state_file"
  printf 'ingest_summary_status=ok\n'
  printf 'ingest_summary_path=%s\n' "$(relative_to_board "$board_root" "$summary_path")"
  if [ "$summary_existed" = "true" ]; then
    printf 'ingest_summary_write=updated\n'
  else
    printf 'ingest_summary_write=created\n'
  fi
}

run_retrofit_frontmatter() {
  local project_root="$1"
  local board_dir_name="$2"
  local dry_run="$3"
  local page_filter="$4"
  local allow_adapter="$5"
  local runner_id="$6"
  local board_root wiki_root pages_file file rel repo_rel kind slug title title_source created updated tags_csv
  local frontmatter_file tmp_file today adapter_result_file adapter_title adapter_tags
  local idx=0 total=0 written=0 skipped=0 dry_run_count=0 warning_count=0

  board_root="$(board_root_path "$project_root" "$board_dir_name")"
  wiki_root="${board_root}/wiki"
  pages_file="$(autoflow_mktemp)"

  if ! board_is_initialized "$board_root"; then
    printf 'status=blocked\n'
    printf 'reason=board_not_initialized\n'
    printf 'project_root=%s\n' "$project_root"
    printf 'board_root=%s\n' "$board_root"
    exit 0
  fi

  if [ ! -d "$wiki_root" ]; then
    printf 'status=warning\n'
    printf 'reason=wiki_root_missing\n'
    printf 'project_root=%s\n' "$project_root"
    printf 'board_root=%s\n' "$board_root"
    printf 'wiki_root=%s\n' "$wiki_root"
    exit 0
  fi

  if [ -n "$page_filter" ]; then
    case "$page_filter" in
      wiki/*.md) ;;
      *)
        printf 'status=blocked\n'
        printf 'reason=invalid_page_path\n'
        printf 'page=%s\n' "$page_filter"
        exit 1
        ;;
    esac
    printf '%s/%s\n' "$board_root" "$page_filter" > "$pages_file"
  else
    {
      find "${wiki_root}/decisions" -type f -name '*.md' ! -name 'README.md' 2>/dev/null || true
      find "${wiki_root}/features" -type f -name '*.md' ! -name 'README.md' 2>/dev/null || true
      find "${wiki_root}/learnings" -type f -name '*.md' ! -name 'README.md' 2>/dev/null || true
      find "${wiki_root}/architecture" -type f -name '*.md' ! -name 'README.md' 2>/dev/null || true
    } | sort > "$pages_file"
  fi

  if [ "$allow_adapter" = "true" ] && [ -z "$runner_id" ]; then
    runner_id="$(find_wiki_runner "$board_root" "" 2>/dev/null || true)"
  fi

  today="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

  while IFS= read -r file; do
    [ -n "$file" ] || continue
    rel="$(relative_to_board "$board_root" "$file")"
    idx="$((idx + 1))"

    if [ ! -f "$file" ]; then
      skipped="$((skipped + 1))"
      printf 'retrofit.%s.page=%s\n' "$idx" "$rel"
      printf 'retrofit.%s.status=skipped_missing\n' "$idx"
      continue
    fi

    if retrofit_is_excluded_page "$rel"; then
      skipped="$((skipped + 1))"
      printf 'retrofit.%s.page=%s\n' "$idx" "$rel"
      printf 'retrofit.%s.status=skipped_excluded\n' "$idx"
      continue
    fi

    total="$((total + 1))"
    printf 'retrofit.%s.page=%s\n' "$idx" "$rel"

    if retrofit_has_frontmatter "$file"; then
      skipped="$((skipped + 1))"
      printf 'retrofit.%s.status=skipped_already_has_frontmatter\n' "$idx"
      continue
    fi

    kind="$(retrofit_kind_from_rel "$rel")"
    slug="$(basename "$file" .md)"
    title="$(wiki_first_h1_title "$file")"
    title_source="h1"
    if [ -z "$title" ]; then
      title="$(wiki_title_from_slug "$slug")"
      title_source="slug_fallback"
    fi

    repo_rel="${board_dir_name}/${rel}"
    created="$(retrofit_git_timestamp "$project_root" "$repo_rel" "created")"
    if [ -z "$created" ]; then
      created="$today"
      warning_count="$((warning_count + 1))"
      printf 'retrofit_warning.%s=missing_git_history_for=%s\n' "$warning_count" "$rel"
    fi
    updated="$(retrofit_git_timestamp "$project_root" "$repo_rel" "updated")"
    [ -n "$updated" ] || updated="$created"
    tags_csv="$(retrofit_tags_csv "$kind" "$slug" "$rel")"

    if [ "$allow_adapter" = "true" ] && [ "$title_source" = "slug_fallback" ]; then
      adapter_result_file="$(autoflow_mktemp)"
      retrofit_maybe_adapter_title_tags "$project_root" "$board_root" "$runner_id" "$file" "$rel" "$title" "$tags_csv" > "$adapter_result_file"
      grep '^retrofit_adapter_' "$adapter_result_file" || true
      adapter_title="$(awk -F= '$1 == "title" { sub(/^[^=]*=/, ""); print; exit }' "$adapter_result_file")"
      adapter_tags="$(awk -F= '$1 == "tags" { sub(/^[^=]*=/, ""); print; exit }' "$adapter_result_file")"
      [ -n "$adapter_title" ] && title="$adapter_title"
      [ -n "$adapter_tags" ] && tags_csv="$adapter_tags"
    fi

    frontmatter_file="$(autoflow_mktemp)"
    retrofit_write_frontmatter_file "$frontmatter_file" "$kind" "$slug" "$title" "$created" "$updated" "$tags_csv"

    if [ "$dry_run" = "true" ]; then
      dry_run_count="$((dry_run_count + 1))"
      printf 'retrofit.%s.status=dry_run\n' "$idx"
      printf 'retrofit.%s.kind=%s\n' "$idx" "$kind"
      printf 'retrofit.%s.slug=%s\n' "$idx" "$slug"
      printf 'retrofit.%s.title=%s\n' "$idx" "$(wiki_output_escape "$title")"
      printf 'retrofit.%s.created=%s\n' "$idx" "$created"
      printf 'retrofit.%s.updated=%s\n' "$idx" "$updated"
      printf 'retrofit.%s.tags=%s\n' "$idx" "$tags_csv"
      printf 'retrofit.%s.frontmatter_begin\n' "$idx"
      cat "$frontmatter_file"
      printf 'retrofit.%s.frontmatter_end\n' "$idx"
      continue
    fi

    tmp_file="$(autoflow_mktemp)"
    {
      cat "$frontmatter_file"
      printf '\n'
      cat "$file"
    } > "$tmp_file"
    mv "$tmp_file" "$file"
    written="$((written + 1))"
    printf 'retrofit.%s.status=written\n' "$idx"
  done < "$pages_file"

  printf 'status=ok\n'
  printf 'project_root=%s\n' "$project_root"
  printf 'board_root=%s\n' "$board_root"
  printf 'wiki_root=%s\n' "$wiki_root"
  printf 'retrofit_total=%s\n' "$total"
  printf 'retrofit_written=%s\n' "$written"
  printf 'retrofit_skipped=%s\n' "$skipped"
  printf 'retrofit_dry_run=%s\n' "$dry_run_count"
  printf 'retrofit_allow_adapter=%s\n' "$allow_adapter"
  printf 'retrofit_warning_count=%s\n' "$warning_count"
}

run_semantic_lint() {
  local project_root="$1"
  local board_root="$2"
  local wiki_root="$3"
  local explicit_runner_id="${4:-}"
  local runner_id prompt_file stdout_file stderr_file adapter_exit
  local pages_file fingerprint_path current_fingerprint previous_fingerprint
  local changed_pages_file neighbors_file selected_pages_file dropped_pages_file
  local prompt_header_file budget prompt_bytes truncated_flag
  local selected_count dropped_count line page rel
  local debug_path

  runner_id="$(find_wiki_runner "$board_root" "$explicit_runner_id" || true)"
  if [ -z "$runner_id" ]; then
    printf 'semantic_status=skipped_no_adapter\n'
    return 0
  fi

  pages_file="$(autoflow_mktemp)"
  prompt_file="$(autoflow_mktemp)"
  stdout_file="$(autoflow_mktemp)"
  stderr_file="$(autoflow_mktemp)"
  changed_pages_file="$(autoflow_mktemp)"
  neighbors_file="$(autoflow_mktemp)"
  selected_pages_file="$(autoflow_mktemp)"
  dropped_pages_file="$(autoflow_mktemp)"
  prompt_header_file="$(autoflow_mktemp)"

  find "$wiki_root" -type f -name '*.md' ! -name 'README.md' | sort > "$pages_file"
  current_fingerprint="$(semantic_lint_pages_fingerprint "$board_root" "$pages_file")"
  fingerprint_path="$(semantic_lint_fingerprint_path "$board_root" "$runner_id")"
  previous_fingerprint=""
  if [ -f "$fingerprint_path" ]; then
    previous_fingerprint="$(cat "$fingerprint_path" 2>/dev/null || true)"
  fi

  if [ -n "$previous_fingerprint" ] && [ "$current_fingerprint" = "$previous_fingerprint" ]; then
    printf 'semantic_status=skipped_unchanged\n'
    printf 'semantic_runner=%s\n' "$runner_id"
    printf 'semantic_reason=wiki_inputs_unchanged\n'
    printf 'semantic_fingerprint=%s\n' "$current_fingerprint"
    printf 'semantic_fingerprint_path=%s\n' "$fingerprint_path"
    return 0
  fi

  # Per-page diff: only changed pages plus pages that link to them go to the adapter.
  semantic_lint_emit_changed_pages "$board_root" "$runner_id" "$pages_file" \
    | sort -u > "$changed_pages_file"

  if [ ! -s "$changed_pages_file" ]; then
    # Whole-wiki fingerprint moved (e.g. file mtime / order shift) but no per-page
    # checksum changed. Treat as unchanged at content level, just refresh the
    # whole-wiki fingerprint and persist current per-page sums.
    printf 'semantic_status=skipped_unchanged_per_page\n'
    printf 'semantic_runner=%s\n' "$runner_id"
    printf 'semantic_reason=per_page_inputs_unchanged\n'
    printf 'semantic_fingerprint=%s\n' "$current_fingerprint"
    printf 'semantic_fingerprint_path=%s\n' "$fingerprint_path"
    semantic_lint_record_per_page "$board_root" "$runner_id" "$pages_file"
    semantic_lint_record_fingerprint "$board_root" "$runner_id" "$current_fingerprint"
    return 0
  fi

  semantic_lint_emit_neighbors "$board_root" "$pages_file" "$changed_pages_file" \
    | sort -u > "$neighbors_file"

  # Selected = changed pages first, then inbound neighbors. Preserve a stable order
  # so byte-budget truncation always drops the lowest-priority pages first.
  {
    cat "$changed_pages_file"
    if [ -s "$neighbors_file" ]; then
      grep -Fxv -f "$changed_pages_file" "$neighbors_file" 2>/dev/null || true
    fi
  } > "$selected_pages_file"

  selected_count="$(count_lines "$selected_pages_file")"

  # Build the prompt header (instructions only) to its own file so we can compute
  # remaining byte budget for page bodies.
  {
    printf 'You review Autoflow wiki pages for contradictions, stale claims, and missing links.\n'
    printf 'Only the pages whose content has changed since the last successful run plus their inbound-link neighbors are included below; all unchanged pages have been intentionally elided to save tokens.\n'
    printf 'Keep the exact output keys and format. Write natural-language summary values in Korean.\n'
    printf 'Return plain text lines only in this format:\n'
    printf 'semantic_finding.1.page=<board-relative path>\n'
    printf 'semantic_finding.1.kind=contradiction|stale_claim|missing_link\n'
    printf 'semantic_finding.1.summary=<one concise Korean sentence>\n'
    printf 'If there are no semantic issues, return exactly: semantic_finding.none=true\n\n'
  } > "$prompt_header_file"

  budget="${AUTOFLOW_WIKI_LINT_PROMPT_BYTES:-32768}"
  case "$budget" in
    ''|*[!0-9]*) budget=32768 ;;
  esac

  local body_lines="${AUTOFLOW_WIKI_LINT_BODY_LINES:-80}"
  case "$body_lines" in
    ''|*[!0-9]*) body_lines=80 ;;
  esac

  cp "$prompt_header_file" "$prompt_file"
  truncated_flag="false"
  : > "$dropped_pages_file"

  while IFS= read -r rel; do
    [ -n "$rel" ] || continue
    page="${board_root}/${rel}"
    [ -f "$page" ] || continue

    local section_file
    section_file="$(autoflow_mktemp)"
    {
      printf -- '--- PAGE: %s ---\n' "$rel"
      sed -n "1,${body_lines}p" "$page"
      printf '\n'
    } > "$section_file"

    local current_bytes section_bytes projected
    current_bytes="$(wc -c < "$prompt_file" | tr -d '[:space:]')"
    section_bytes="$(wc -c < "$section_file" | tr -d '[:space:]')"
    projected=$((current_bytes + section_bytes))

    if [ "$projected" -le "$budget" ]; then
      cat "$section_file" >> "$prompt_file"
    else
      truncated_flag="true"
      printf '%s\n' "$rel" >> "$dropped_pages_file"
    fi
  done < "$selected_pages_file"

  prompt_bytes="$(wc -c < "$prompt_file" | tr -d '[:space:]')"
  dropped_count="$(count_lines "$dropped_pages_file")"

  # Optional debug hook: copy the assembled prompt for verifier inspection.
  debug_path="${AUTOFLOW_WIKI_LINT_DEBUG_PROMPT_PATH:-}"
  if [ -n "$debug_path" ]; then
    mkdir -p "$(dirname "$debug_path")" 2>/dev/null || true
    cp "$prompt_file" "$debug_path" 2>/dev/null || true
  fi

  set +e
  run_wiki_adapter_prompt "$project_root" "$board_root" "$runner_id" "$prompt_file" "$stdout_file" "$stderr_file"
  adapter_exit=$?
  set -e

  if [ "$adapter_exit" -eq 127 ]; then
    printf 'semantic_status=skipped_no_adapter\n'
    return 0
  fi

  if [ "$adapter_exit" -ne 0 ]; then
    printf 'semantic_status=failed\n'
    printf 'semantic_runner=%s\n' "$runner_id"
    printf 'semantic_exit_code=%s\n' "$adapter_exit"
    return 0
  fi

  printf 'semantic_status=ok\n'
  printf 'semantic_runner=%s\n' "$runner_id"
  printf 'semantic_fingerprint=%s\n' "$current_fingerprint"
  printf 'semantic_fingerprint_path=%s\n' "$fingerprint_path"
  printf 'semantic_selected_count=%s\n' "${selected_count:-0}"
  printf 'semantic_prompt_bytes=%s\n' "${prompt_bytes:-0}"
  printf 'semantic_prompt_budget=%s\n' "$budget"
  printf 'semantic_truncated=%s\n' "$truncated_flag"
  if [ "$truncated_flag" = "true" ] && [ "$dropped_count" -gt 0 ]; then
    local drop_idx=0
    while IFS= read -r line; do
      [ -n "$line" ] || continue
      drop_idx=$((drop_idx + 1))
      printf 'semantic_dropped_pages.%d=%s\n' "$drop_idx" "$line"
    done < "$dropped_pages_file"
    printf 'semantic_dropped_count=%s\n' "$drop_idx"
  fi
  while IFS= read -r line; do
    [ -n "$line" ] || continue
    case "$line" in
      semantic_finding.none=true|semantic_finding.[0-9]*.page=*|semantic_finding.[0-9]*.kind=*|semantic_finding.[0-9]*.summary=*)
        printf '%s\n' "$(wiki_output_escape "$line")"
        ;;
    esac
  done < "$stdout_file"
  semantic_lint_record_fingerprint "$board_root" "$runner_id" "$current_fingerprint"
  semantic_lint_record_per_page "$board_root" "$runner_id" "$pages_file"
}

run_query() {
  local project_root="$1"
  local board_dir_name="$2"
  local terms_file="$3"
  local limit="$4"
  local include_tickets="$5"
  local include_handoffs="$6"
  local with_snippets="$7"
  local synth_mode="${8:-false}"
  local synth_runner_id="${9:-}"
  local save_as_slug="${10:-}"
  local rag_mode="${11:-false}"

  local board_root wiki_root candidates scores sorted synth_results
  local term_count=0 result_count=0 emitted=0
  local chunk_lines chunk_overlap

  board_root="$(board_root_path "$project_root" "$board_dir_name")"
  wiki_root="${board_root}/wiki"

  if ! board_is_initialized "$board_root"; then
    printf 'status=blocked\n'
    printf 'reason=board_not_initialized\n'
    printf 'project_root=%s\n' "$project_root"
    printf 'board_root=%s\n' "$board_root"
    exit 0
  fi

  if [ ! -s "$terms_file" ]; then
    printf 'status=blocked\n'
    printf 'reason=no_terms_provided\n'
    printf 'project_root=%s\n' "$project_root"
    printf 'board_root=%s\n' "$board_root"
    printf 'wiki_root=%s\n' "$wiki_root"
    exit 0
  fi

  candidates="$(autoflow_mktemp)"
  scores="$(autoflow_mktemp)"
  sorted="$(autoflow_mktemp)"
  synth_results="$(autoflow_mktemp)"

  if [ -d "$wiki_root" ]; then
    find "$wiki_root" -type f -name '*.md' ! -name 'README.md' >> "$candidates"
  fi
  if [ "$include_tickets" = "true" ]; then
    if [ -d "${board_root}/tickets/done" ]; then
      find "${board_root}/tickets/done" -type f -name '*.md' ! -name 'README.md' >> "$candidates"
    fi
    if [ -d "${board_root}/tickets/reject" ]; then
      find "${board_root}/tickets/reject" -type f -name '*.md' ! -name 'README.md' >> "$candidates"
    fi
  fi
  if [ "$include_handoffs" = "true" ]; then
    if [ -d "${board_root}/conversations" ]; then
      find "${board_root}/conversations" -type f -name '*.md' ! -name 'README.md' >> "$candidates"
    fi
  fi

  chunk_lines="$(wiki_query_rag_chunk_lines)"
  chunk_overlap="$(wiki_query_rag_chunk_overlap "$chunk_lines")"
  if [ "$rag_mode" = "true" ]; then
    wiki_query_score_chunks "$candidates" "$terms_file" "$scores" "$chunk_lines" "$chunk_overlap"
  else
    while IFS= read -r file; do
      [ -n "$file" ] || continue
      local file_score
      file_score="$(wiki_query_score_file "$file" "$terms_file")"
      if [ "$file_score" -gt 0 ]; then
        printf '%s\t%s\n' "$file_score" "$file" >> "$scores"
      fi
    done < "$candidates"
  fi

  if [ -s "$scores" ]; then
    sort -t$'\t' -k1,1nr -k2,2 -k3,3n "$scores" > "$sorted"
  fi

  result_count="$(count_lines "$sorted")"
  term_count="$(count_lines "$terms_file")"

  printf 'status=ok\n'
  printf 'project_root=%s\n' "$project_root"
  printf 'board_root=%s\n' "$board_root"
  printf 'wiki_root=%s\n' "$wiki_root"
  printf 'limit=%s\n' "$limit"
  printf 'include_tickets=%s\n' "$include_tickets"
  printf 'include_handoffs=%s\n' "$include_handoffs"
  printf 'with_snippets=%s\n' "$with_snippets"
  if [ "$rag_mode" = "true" ]; then
    printf 'retrieval_mode=rag\n'
    printf 'rag_chunk_lines=%s\n' "$chunk_lines"
    printf 'rag_chunk_overlap=%s\n' "$chunk_overlap"
  else
    printf 'retrieval_mode=file\n'
  fi
  printf 'term_count=%s\n' "$term_count"

  local idx=0 term
  while IFS= read -r term; do
    [ -n "$term" ] || continue
    idx=$((idx + 1))
    printf 'term.%d=%s\n' "$idx" "$term"
  done < "$terms_file"

  printf 'result_count=%s\n' "$result_count"

  if [ "$result_count" -eq 0 ]; then
    if [ "$synth_mode" = "true" ]; then
      printf 'synth_status=skipped_no_results\n'
      printf 'synth_citation_count=0\n'
    fi
    return 0
  fi

  while IFS=$'\t' read -r score file chunk_start chunk_end chunk_file; do
    [ -n "$file" ] || continue
    emitted=$((emitted + 1))
    [ "$emitted" -le "$limit" ] || break

    local rel kind title
    rel="$(relative_to_board "$board_root" "$file")"
    kind="$(result_kind_from_path "$rel")"
    title="$(first_meaningful_title "$file")"
    [ -n "$title" ] || title="$(basename "$file")"

    printf 'result.%d.path=%s\n' "$emitted" "$rel"
    printf 'result.%d.title=%s\n' "$emitted" "$title"
    printf 'result.%d.kind=%s\n' "$emitted" "$kind"
    printf 'result.%d.score=%s\n' "$emitted" "$score"
    if [ "$rag_mode" = "true" ]; then
      printf 'result.%d.chunk_start_line=%s\n' "$emitted" "$chunk_start"
      printf 'result.%d.chunk_end_line=%s\n' "$emitted" "$chunk_end"
    fi
    {
      printf 'path=%s\n' "$rel"
      printf 'title=%s\n' "$title"
      printf 'kind=%s\n' "$kind"
      printf 'score=%s\n' "$score"
      if [ "$rag_mode" = "true" ]; then
        printf 'chunk_start_line=%s\n' "$chunk_start"
        printf 'chunk_end_line=%s\n' "$chunk_end"
      fi
    } >> "$synth_results"

    if [ "$rag_mode" = "true" ]; then
      local chunk_text
      if [ "$with_snippets" = "true" ] && [ -f "$chunk_file" ]; then
        chunk_text="$(trim_text "$(cat "$chunk_file")")"
        printf 'result.%d.snippet.1.line=%s\n' "$emitted" "$chunk_start"
        printf 'result.%d.snippet.1.text=%s\n' "$emitted" "$chunk_text"
        printf 'result.%d.snippet_count=1\n' "$emitted"
        printf 'snippet.1=%s-%s:%s\n' "$chunk_start" "$chunk_end" "$chunk_text" >> "$synth_results"
      else
        printf 'result.%d.snippet_count=0\n' "$emitted"
      fi
      printf -- '--\n' >> "$synth_results"
      continue
    fi

    if [ "$with_snippets" != "true" ]; then
      printf 'result.%d.snippet_count=0\n' "$emitted"
      printf -- '--\n' >> "$synth_results"
      continue
    fi

    local snippets snippet_idx=0 lineno linetext snippet_line snippet_text
    snippets="$(autoflow_mktemp)"
    : > "$snippets"
    while IFS= read -r term; do
      [ -n "$term" ] || continue
      grep -Fin -- "$term" "$file" 2>/dev/null | head -n 5 >> "$snippets" || true
    done < "$terms_file"

    if [ -s "$snippets" ]; then
      sort -u -t: -k1,1 -n "$snippets" -o "$snippets"
    fi

    while IFS= read -r snippet_line; do
      [ -n "$snippet_line" ] || continue
      snippet_idx=$((snippet_idx + 1))
      [ "$snippet_idx" -le 3 ] || break
      lineno="${snippet_line%%:*}"
      linetext="${snippet_line#*:}"
      snippet_text="$(trim_text "$linetext")"
      printf 'result.%d.snippet.%d.line=%s\n' "$emitted" "$snippet_idx" "$lineno"
      printf 'result.%d.snippet.%d.text=%s\n' "$emitted" "$snippet_idx" "$snippet_text"
      printf 'snippet.%d=%s:%s\n' "$snippet_idx" "$lineno" "$snippet_text" >> "$synth_results"
    done < "$snippets"
    printf 'result.%d.snippet_count=%s\n' "$emitted" "$snippet_idx"
    printf -- '--\n' >> "$synth_results"
  done < "$sorted"

  if [ "$synth_mode" = "true" ]; then
    run_query_synth "$project_root" "$board_root" "$terms_file" "$synth_results" "$synth_runner_id" "$save_as_slug"
  fi
}

run_update() {
  local project_root="$1"
  local board_dir_name="$2"
  local dry_run="$3"
  local board_root wiki_root
  local done_tickets reject_files verifier_logs
  local done_count reject_count log_count timestamp
  local index_body log_body overview_body
  local index_default log_default overview_default
  local status changed_count=0 changed_files_list
  local changed_file idx

  board_root="$(board_root_path "$project_root" "$board_dir_name")"
  wiki_root="${board_root}/wiki"

  if ! board_is_initialized "$board_root"; then
    printf 'status=blocked\n'
    printf 'reason=board_not_initialized\n'
    printf 'project_root=%s\n' "$project_root"
    printf 'board_root=%s\n' "$board_root"
    exit 0
  fi

  done_tickets="$(autoflow_mktemp)"
  reject_files="$(autoflow_mktemp)"
  verifier_logs="$(autoflow_mktemp)"
  handoff_files="$(autoflow_mktemp)"
  collect_files "${board_root}/tickets/done" 'tickets_[0-9][0-9][0-9].md' "$done_tickets"
  collect_files "${board_root}/tickets" 'reject_[0-9][0-9][0-9].md' "$reject_files"
  collect_files "${board_root}/logs" '*.md' "$verifier_logs"
  collect_files "${board_root}/conversations" 'spec-handoff.md' "$handoff_files"

  done_count="$(count_lines "$done_tickets")"
  reject_count="$(count_lines "$reject_files")"
  log_count="$(count_lines "$verifier_logs")"
  handoff_count="$(count_lines "$handoff_files")"
  timestamp="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

  index_body="$(autoflow_mktemp)"
  log_body="$(autoflow_mktemp)"
  overview_body="$(autoflow_mktemp)"
  index_default="$(autoflow_mktemp)"
  log_default="$(autoflow_mktemp)"
  overview_default="$(autoflow_mktemp)"
  changed_files_list="$(autoflow_mktemp)"
  : > "$changed_files_list"
  write_default_pages "$index_default" "$log_default" "$overview_default"

  {
    printf '## Autoflow Work Map\n\n'
    printf -- '- Done tickets: %s\n' "$done_count"
    printf -- '- Reject records: %s\n' "$reject_count"
    printf -- '- Verifier logs: %s\n' "$log_count"
    printf -- '- Conversation handoffs: %s\n' "$handoff_count"
    printf -- '- Last updated: %s\n\n' "$timestamp"
    printf '## Completed Tickets\n\n'
    write_ticket_list "$board_root" "$done_tickets" 20
  } > "$index_body"

  {
    printf '## Derived Timeline\n\n'
    printf -- '- Last rebuilt: %s\n\n' "$timestamp"
    printf '### Completed Tickets\n\n'
    write_ticket_list "$board_root" "$done_tickets" 20
    printf '\n### Verifier Logs\n\n'
    write_log_list "$board_root" "$verifier_logs" 20
    printf '\n### Reject Records\n\n'
    write_reject_list "$board_root" "$reject_files" 20
    printf '\n### Conversation Handoffs\n\n'
    write_handoff_list "$board_root" "$handoff_files" 20
  } > "$log_body"

  {
    printf '## Current Autoflow Summary\n\n'
    printf -- '- Project root: `%s`\n' "$project_root"
    printf -- '- Board root: `%s`\n' "$board_root"
    printf -- '- Done tickets: %s\n' "$done_count"
    printf -- '- Reject records: %s\n' "$reject_count"
    printf -- '- Verifier logs: %s\n' "$log_count"
    printf -- '- Conversation handoffs: %s\n' "$handoff_count"
    printf -- '- Last updated: %s\n\n' "$timestamp"
    printf '## Latest Completed Work\n\n'
    write_ticket_list "$board_root" "$done_tickets" 20
    printf '\n## Recent Handoffs\n\n'
    write_handoff_list "$board_root" "$handoff_files" 5
  } > "$overview_body"

  if [ "$dry_run" = "true" ]; then
    printf 'status=dry_run\n'
    printf 'project_root=%s\n' "$project_root"
    printf 'board_root=%s\n' "$board_root"
    printf 'wiki_root=%s\n' "$wiki_root"
    printf 'ticket_done_count=%s\n' "$done_count"
    printf 'reject_count=%s\n' "$reject_count"
    printf 'log_count=%s\n' "$log_count"
    printf 'handoff_count=%s\n' "$handoff_count"
    printf 'index_section_begin\n'
    cat "$index_body"
    printf 'index_section_end\n'
    exit 0
  fi

  mkdir -p "$wiki_root"
  mkdir -p "${board_root}/runners/state"
  acquire_wiki_baseline_lock "${board_root}/runners/state/wiki-baseline.lock"
  trap 'release_wiki_baseline_lock "${board_root}/runners/state/wiki-baseline.lock"' EXIT
  if replace_managed_section "${wiki_root}/index.md" "work-map" "$index_body" "$index_default"; then
    printf '%s\n' "${wiki_root}/index.md" >> "$changed_files_list"
  fi
  if replace_managed_section "${wiki_root}/log.md" "derived-timeline" "$log_body" "$log_default"; then
    printf '%s\n' "${wiki_root}/log.md" >> "$changed_files_list"
  fi
  if replace_managed_section "${wiki_root}/project-overview.md" "project-summary" "$overview_body" "$overview_default"; then
    printf '%s\n' "${wiki_root}/project-overview.md" >> "$changed_files_list"
  fi
  release_wiki_baseline_lock "${board_root}/runners/state/wiki-baseline.lock"
  trap - EXIT

  changed_count="$(count_lines "$changed_files_list")"
  if [ "$changed_count" -gt 0 ]; then
    status="updated"
  else
    status="unchanged"
  fi
  write_wiki_baseline_history "$board_root" "$wiki_root" "$status" "$timestamp" "$done_count" "$reject_count" "$log_count" "$handoff_count" "$changed_count"

  printf 'status=%s\n' "$status"
  printf 'project_root=%s\n' "$project_root"
  printf 'board_root=%s\n' "$board_root"
  printf 'wiki_root=%s\n' "$wiki_root"
  printf 'checked_at=%s\n' "$timestamp"
  printf 'ticket_done_count=%s\n' "$done_count"
  printf 'reject_count=%s\n' "$reject_count"
  printf 'log_count=%s\n' "$log_count"
  printf 'handoff_count=%s\n' "$handoff_count"
  printf 'changed_file_count=%s\n' "$changed_count"
  printf 'history_file=%s\n' "${board_root}/runners/state/wiki-baseline.history"
  idx=0
  while IFS= read -r changed_file; do
    [ -n "$changed_file" ] || continue
    idx="$((idx + 1))"
    printf 'updated_file.%s=%s\n' "$idx" "$changed_file"
  done < "$changed_files_list"
  printf 'next_action=Open the Desktop Wiki Pages panel or run autoflow wiki lint.\n'
}

run_lint() {
  local project_root="$1"
  local board_dir_name="$2"
  local semantic_mode="${3:-false}"
  local semantic_runner_id="${4:-}"
  local board_root wiki_root index_file pages_file
  local page_count=0 orphan_count=0 citation_gap_count=0 stale_reference_count=0
  local broken_link_count=0 missing_frontmatter_count=0 lint_finding_total=0
  local file rel stem content stems_file all_stems_file link_target page_first_line link_path
  local status="ok"

  board_root="$(board_root_path "$project_root" "$board_dir_name")"
  wiki_root="${board_root}/wiki"
  index_file="${wiki_root}/index.md"
  pages_file="$(autoflow_mktemp)"

  if ! board_is_initialized "$board_root"; then
    printf 'status=blocked\n'
    printf 'reason=board_not_initialized\n'
    printf 'project_root=%s\n' "$project_root"
    printf 'board_root=%s\n' "$board_root"
    exit 0
  fi

  if [ ! -d "$wiki_root" ]; then
    printf 'status=warning\n'
    printf 'reason=wiki_root_missing\n'
    printf 'project_root=%s\n' "$project_root"
    printf 'board_root=%s\n' "$board_root"
    printf 'wiki_root=%s\n' "$wiki_root"
    exit 0
  fi

  collect_files "$wiki_root" '*.md' "$pages_file"
  page_count="$(count_lines "$pages_file")"
  content=""
  if [ -f "$index_file" ]; then
    content="$(cat "$index_file")"
  fi

  # Pre-compute the set of valid wikilink targets (page stems) so broken-link
  # detection does not need a per-page filesystem walk.
  all_stems_file="$(autoflow_mktemp)"
  while IFS= read -r file; do
    [ -n "$file" ] || continue
    [ "$(basename "$file")" = "README.md" ] && continue
    basename "$file" .md
  done < "$pages_file" | sort -u > "$all_stems_file"

  while IFS= read -r file; do
    [ -n "$file" ] || continue
    rel="$(relative_to_board "$board_root" "$file")"
    stem="$(basename "$file" .md)"
    link_path="${rel#wiki/}"
    link_path="${link_path%.md}"

    case "$stem" in
      index)
        continue
        ;;
    esac

    if [ "$(basename "$file")" = "README.md" ]; then
      continue
    fi

    if ! printf '%s\n' "$content" | grep -Fq "[[${stem}]]" && \
       ! printf '%s\n' "$content" | grep -Fq "[[${link_path}]]" && \
       ! printf '%s\n' "$content" | grep -Fq "$rel"; then
      orphan_count="$((orphan_count + 1))"
      printf 'orphan.%s=%s\n' "$orphan_count" "$rel"
      printf 'lint_orphan.%s.page=%s\n' "$orphan_count" "$rel"
    fi

    # Broken-link check: collect every `[[target]]` from the page body and verify
    # each target resolves to a known page stem (without `.md`). Skip targets that
    # contain `|` (alias syntax) by trimming after the pipe, and skip targets that
    # contain `/` (relative path links — those are checked against stem matches by
    # last segment).
    local link_targets_file link_target_clean link_target_segment
    link_targets_file="$(autoflow_mktemp)"
    grep -Eo '\[\[[^][]+\]\]' "$file" 2>/dev/null \
      | sed -e 's/^\[\[//' -e 's/\]\]$//' \
      | sort -u > "$link_targets_file" || true

    while IFS= read -r link_target; do
      [ -n "$link_target" ] || continue
      # Drop alias/header suffixes: [[target|alias]] and [[target#heading]]
      link_target_clean="${link_target%%|*}"
      link_target_clean="${link_target_clean%%#*}"
      # Use the final path segment as the stem to look up.
      link_target_segment="${link_target_clean##*/}"
      [ -n "$link_target_segment" ] || continue
      if ! grep -Fxq "$link_target_segment" "$all_stems_file"; then
        broken_link_count="$((broken_link_count + 1))"
        printf 'lint_broken_link.%s.page=%s\n' "$broken_link_count" "$rel"
        printf 'lint_broken_link.%s.target=%s\n' "$broken_link_count" "$link_target_clean"
      fi
    done < "$link_targets_file"

    # Missing-frontmatter check: any wiki page that lacks a leading `---` line
    # (excluding index/log/project-overview which are managed by the deterministic
    # baseline) gets flagged. New pages under wiki/answers/ are expected to carry
    # frontmatter from the start; existing pages are reported so a follow-up can
    # retrofit them.
    case "$stem" in
      index|log|project-overview)
        :
        ;;
      *)
        page_first_line="$(awk 'NR == 1 { sub(/\r$/, ""); print; exit }' "$file" 2>/dev/null || true)"
        if [ "$page_first_line" != "---" ]; then
          missing_frontmatter_count="$((missing_frontmatter_count + 1))"
          printf 'lint_missing_frontmatter.%s.page=%s\n' "$missing_frontmatter_count" "$rel"
        fi
        ;;
    esac

    case "$stem" in
      log|project-overview)
        continue
        ;;
    esac

    if grep -Eiq '(completed|implemented|passed|shipped|done)' "$file" && \
       ! grep -Eq '(tickets/|logs/|verify_[0-9]|tickets_[0-9])' "$file"; then
      citation_gap_count="$((citation_gap_count + 1))"
      printf 'citation_gap.%s=%s\n' "$citation_gap_count" "$rel"
    fi

    local refs_file ref ref_path
    refs_file="$(autoflow_mktemp)"
    grep -Eo '`(tickets|logs|conversations)/[^[:space:]`]+`' "$file" 2>/dev/null \
      | sed -e 's/^`//' -e 's/`$//' \
      | sort -u > "$refs_file" || true

    while IFS= read -r ref; do
      [ -n "$ref" ] || continue
      ref_path="${board_root}/${ref}"
      if [ -e "$ref_path" ]; then
        continue
      fi
      stale_reference_count="$((stale_reference_count + 1))"
      printf 'stale_reference.%s.page=%s\n' "$stale_reference_count" "$rel"
      printf 'stale_reference.%s.target=%s\n' "$stale_reference_count" "$ref"
    done < "$refs_file"
  done < "$pages_file"

  lint_finding_total=$((orphan_count + broken_link_count + missing_frontmatter_count))

  if [ "$orphan_count" -gt 0 ] || [ "$citation_gap_count" -gt 0 ] || [ "$stale_reference_count" -gt 0 ] \
    || [ "$broken_link_count" -gt 0 ] || [ "$missing_frontmatter_count" -gt 0 ]; then
    status="warning"
  fi

  if [ "$lint_finding_total" -eq 0 ]; then
    printf 'lint_finding.none=true\n'
  fi

  printf 'status=%s\n' "$status"
  printf 'project_root=%s\n' "$project_root"
  printf 'board_root=%s\n' "$board_root"
  printf 'wiki_root=%s\n' "$wiki_root"
  printf 'page_count=%s\n' "$page_count"
  printf 'orphan_count=%s\n' "$orphan_count"
  printf 'citation_gap_count=%s\n' "$citation_gap_count"
  printf 'stale_reference_count=%s\n' "$stale_reference_count"
  printf 'broken_link_count=%s\n' "$broken_link_count"
  printf 'missing_frontmatter_count=%s\n' "$missing_frontmatter_count"
  printf 'lint_finding_total=%s\n' "$lint_finding_total"

  if [ "$semantic_mode" = "true" ]; then
    run_semantic_lint "$project_root" "$board_root" "$wiki_root" "$semantic_runner_id"
  fi
}

telemetry_summary_hash_file() {
  local slug="$1"
  local window="$2"
  local filtered_file="$3"

  {
    printf 'slug=%s\n' "$slug"
    printf 'window=%s\n' "$window"
    [ -f "$filtered_file" ] && cat "$filtered_file"
  } | hash_stream
}

telemetry_summary_window_since_epoch() {
  local window="$1"
  local days now_epoch

  case "$window" in
    all)
      printf ''
      return 0
      ;;
    *d)
      days="${window%d}"
      ;;
    *)
      return 1
      ;;
  esac

  if ! [[ "$days" =~ ^[0-9]+$ ]] || [ "$days" -lt 1 ]; then
    return 1
  fi

  now_epoch="$(date -u '+%s')"
  printf '%s' "$((now_epoch - (days * 86400)))"
}

telemetry_summary_filter_jsonl() {
  local input_file="$1"
  local output_file="$2"
  local since_epoch="$3"
  local line timestamp epoch

  : > "$output_file"
  [ -f "$input_file" ] || return 0

  while IFS= read -r line; do
    [ -n "$line" ] || continue
    if ! printf '%s\n' "$line" | jq -e 'type == "object"' >/dev/null 2>&1; then
      continue
    fi
    if [ -z "$since_epoch" ]; then
      printf '%s\n' "$line" >> "$output_file"
      continue
    fi
    timestamp="$(printf '%s\n' "$line" | jq -r '.ended_at // .started_at // empty' 2>/dev/null || true)"
    [ -n "$timestamp" ] || continue
    epoch="$(telemetry_timestamp_to_epoch "$timestamp" 2>/dev/null || true)"
    [ -n "$epoch" ] || continue
    [ "$epoch" -ge "$since_epoch" ] || continue
    printf '%s\n' "$line" >> "$output_file"
  done < "$input_file"
}

telemetry_summary_page_path() {
  local board_root="$1"
  local slug="$2"

  case "$slug" in
    operations/runner-health|operations/runner-timing|agents/prompt-evolution)
      printf '%s/wiki/%s.md' "$board_root" "$slug"
      ;;
    *)
      return 1
      ;;
  esac
}

telemetry_summary_existing_fingerprint() {
  local page="$1"

  [ -f "$page" ] || return 0
  awk -F': ' '
    /^---$/ && NR == 1 { in_fm=1; next }
    in_fm && /^---$/ { exit }
    in_fm && $1 == "input_fingerprint" { print $2; exit }
  ' "$page" 2>/dev/null || true
}

telemetry_summary_write_frontmatter() {
  local target="$1"
  local slug="$2"
  local window="$3"
  local source_event_count="$4"
  local fingerprint="$5"
  local now="$6"

  {
    printf -- '---\n'
    printf 'auto_generated: telemetry-summary\n'
    printf 'slug: %s\n' "$slug"
    printf 'window: %s\n' "$window"
    printf 'source_event_count: %s\n' "$source_event_count"
    printf 'last_synced_at: %s\n' "$now"
    printf 'input_fingerprint: %s\n' "$fingerprint"
    printf -- '---\n\n'
    printf '> This page is auto-generated from `.autoflow/telemetry/*.jsonl`; manual edits may be overwritten on the next sync. Keep durable human notes in `wiki/answers/`, `wiki/decisions/`, or another human-owned wiki page.\n\n'
  } > "$target"
}

telemetry_summary_write_failure_patterns() {
  local failures_file="$1"
  local target="$2"
  local count="$3"
  local runs_file="${4:-}"
  local recovered=0 total=0 rate="0%"
  local failure_line failure_runner failure_ts failure_epoch run_match

  printf '## Failure Patterns\n\n' >> "$target"
  if [ "$count" -eq 0 ]; then
    printf 'no telemetry data yet\n\n' >> "$target"
    return 0
  fi

  printf '| failure_class | count |\n' >> "$target"
  printf '| --- | ---: |\n' >> "$target"
  jq -r '.failure_class // "unknown_failure_class"' "$failures_file" \
    | awk 'NF { counts[$0]++ } END { for (key in counts) print counts[key] "\t" key }' \
    | sort -rn \
    | awk -F'\t' '{ printf "| %s | %s |\n", $2, $1 }' >> "$target"

  printf '\n## Frequent Patterns\n\n' >> "$target"
  jq -r '[.runner_id // "unknown_runner", .failure_class // "unknown_failure_class", .result // "unknown_result"] | join(" / ")' "$failures_file" \
    | awk 'NF { counts[$0]++ } END { for (key in counts) print counts[key] "\t" key }' \
    | sort -rn \
    | head -5 \
    | awk -F'\t' 'BEGIN { print "| pattern | count |"; print "| --- | ---: |" } { printf "| %s | %s |\n", $2, $1 }' >> "$target"

  total="$(count_lines "$failures_file")"
  if [ -n "$runs_file" ] && [ -s "$runs_file" ]; then
    while IFS= read -r failure_line; do
      [ -n "$failure_line" ] || continue
      failure_runner="$(printf '%s\n' "$failure_line" | jq -r '.runner_id // empty' 2>/dev/null || true)"
      failure_ts="$(printf '%s\n' "$failure_line" | jq -r '.ended_at // .started_at // empty' 2>/dev/null || true)"
      failure_epoch="$(telemetry_timestamp_to_epoch "$failure_ts" 2>/dev/null || true)"
      [ -n "$failure_runner" ] || continue
      [ -n "$failure_epoch" ] || continue
      run_match="$(jq -r --arg runner "$failure_runner" --argjson failure_epoch "$failure_epoch" '
        select((.runner_id // "") == $runner)
        | select((.result // "") == "success")
        | (.ended_at // .started_at // empty)
      ' "$runs_file" 2>/dev/null | while IFS= read -r run_ts; do
        [ -n "$run_ts" ] || continue
        local run_epoch
        run_epoch="$(telemetry_timestamp_to_epoch "$run_ts" 2>/dev/null || true)"
        if [ -n "$run_epoch" ] && [ "$run_epoch" -ge "$failure_epoch" ]; then
          printf 'yes\n'
          break
        fi
      done)"
      if [ -n "$run_match" ]; then
        recovered="$((recovered + 1))"
      fi
    done < "$failures_file"
  fi
  if [ "$total" -gt 0 ]; then
    rate="$(awk -v recovered="$recovered" -v total="$total" 'BEGIN { printf "%.0f%%", (recovered / total) * 100 }')"
  fi

  printf '\n## Recovery Rate\n\n' >> "$target"
  printf -- '- Auto recovery rate: %s\n' "$rate" >> "$target"
  printf -- '- Recovery denominator: %s failure events in the selected window.\n\n' "$total" >> "$target"
}

telemetry_summary_write_runner_timing() {
  local runs_file="$1"
  local target="$2"
  local count="$3"

  printf '## Runner Timing\n\n' >> "$target"
  if [ "$count" -eq 0 ]; then
    printf 'no telemetry data yet\n\n' >> "$target"
    return 0
  fi

  printf '| runner_id | tick_count | p50_duration_ms | p95_duration_ms | p99_duration_ms |\n' >> "$target"
  printf '| --- | ---: | ---: | ---: | ---: |\n' >> "$target"
  jq -r 'select((.duration_ms // null) != null) | [.runner_id // "unknown_runner", (.duration_ms | tonumber)] | @tsv' "$runs_file" \
    | sort -k1,1 -k2,2n \
    | awk -F'\t' '
      function emit(runner, n, idx50, idx95, idx99) {
        if (runner == "" || n == 0) return
        idx50 = int((50 * n + 99) / 100); if (idx50 < 1) idx50 = 1
        idx95 = int((95 * n + 99) / 100); if (idx95 < 1) idx95 = 1
        idx99 = int((99 * n + 99) / 100); if (idx99 < 1) idx99 = 1
        printf "| %s | %d | %s | %s | %s |\n", runner, n, values[idx50], values[idx95], values[idx99]
      }
      $1 != current {
        emit(current, n)
        delete values
        current = $1
        n = 0
      }
      {
        n++
        values[n] = $2
      }
      END { emit(current, n) }
    ' >> "$target"
  printf '\n' >> "$target"
}

telemetry_summary_write_prompt_evolution() {
  local runs_file="$1"
  local target="$2"
  local count="$3"

  printf '## Prompt Evolution\n\n' >> "$target"
  if [ "$count" -eq 0 ]; then
    printf 'no telemetry data yet\n\n' >> "$target"
    return 0
  fi

  printf '| prompt_template_hash | usage_count | success_count | success_rate |\n' >> "$target"
  printf '| --- | ---: | ---: | ---: |\n' >> "$target"
  jq -r '[.prompt_template_hash // "unknown_prompt_template", .result // "unknown_result"] | @tsv' "$runs_file" \
    | awk -F'\t' '
      {
        total[$1]++
        if ($2 == "success") success[$1]++
      }
      END {
        for (key in total) {
          rate = total[key] ? (success[key] / total[key]) * 100 : 0
          printf "%d\t%s\t%d\t%.0f%%\n", total[key], key, success[key], rate
        }
      }
    ' \
    | sort -rn \
    | awk -F'\t' '{ printf "| %s | %s | %s | %s |\n", $2, $1, $3, $4 }' >> "$target"
  printf '\n' >> "$target"
}

run_summarize_telemetry_slug() {
  local project_root="$1"
  local board_dir_name="$2"
  local slug="$3"
  local window="$4"
  local board_root page source_file filtered_file fingerprint existing_fingerprint
  local source_event_count now runs_file failures_file filtered_runs_file fingerprint_input_file

  board_root="$(board_root_path "$project_root" "$board_dir_name")"
  if ! board_is_initialized "$board_root"; then
    printf 'summary_status=blocked\n'
    printf 'reason=board_not_initialized\n'
    printf 'slug=%s\n' "$slug"
    printf 'source_event_count=0\n'
    return 0
  fi

  page="$(telemetry_summary_page_path "$board_root" "$slug" || true)"
  if [ -z "$page" ]; then
    printf 'summary_status=blocked\n'
    printf 'reason=unknown_slug\n'
    printf 'slug=%s\n' "$slug"
    printf 'source_event_count=0\n'
    return 0
  fi

  runs_file="$(telemetry_runs_jsonl_path "$project_root")"
  failures_file="$(telemetry_failures_jsonl_path "$project_root")"
  case "$slug" in
    operations/runner-health) source_file="$failures_file" ;;
    operations/runner-timing|agents/prompt-evolution) source_file="$runs_file" ;;
  esac

  local since_epoch
  since_epoch="$(telemetry_summary_window_since_epoch "$window" || true)"
  if [ "$window" != "all" ] && [ -z "$since_epoch" ]; then
    printf 'summary_status=blocked\n'
    printf 'reason=invalid_window\n'
    printf 'slug=%s\n' "$slug"
    printf 'source_event_count=0\n'
    return 0
  fi

  filtered_file="$(autoflow_mktemp)"
  telemetry_summary_filter_jsonl "$source_file" "$filtered_file" "$since_epoch"
  fingerprint_input_file="$filtered_file"
  filtered_runs_file=""
  if [ "$slug" = "operations/runner-health" ]; then
    filtered_runs_file="$(autoflow_mktemp)"
    telemetry_summary_filter_jsonl "$runs_file" "$filtered_runs_file" "$since_epoch"
    fingerprint_input_file="$(autoflow_mktemp)"
    {
      printf 'failures\n'
      cat "$filtered_file"
      printf 'runs\n'
      cat "$filtered_runs_file"
    } > "$fingerprint_input_file"
  fi
  source_event_count="$(count_lines "$filtered_file")"
  fingerprint="$(telemetry_summary_hash_file "$slug" "$window" "$fingerprint_input_file")"
  existing_fingerprint="$(telemetry_summary_existing_fingerprint "$page")"

  if [ -f "$page" ] && [ -n "$existing_fingerprint" ] && [ "$existing_fingerprint" = "$fingerprint" ]; then
    printf 'summary_status=skipped_unchanged\n'
    printf 'slug=%s\n' "$slug"
    printf 'source_event_count=%s\n' "$source_event_count"
    printf 'page=%s\n' "$(relative_to_board "$board_root" "$page")"
    return 0
  fi

  mkdir -p "$(dirname "$page")"
  now="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  telemetry_summary_write_frontmatter "$page" "$slug" "$window" "$source_event_count" "$fingerprint" "$now"
  case "$slug" in
    operations/runner-health)
      telemetry_summary_write_failure_patterns "$filtered_file" "$page" "$source_event_count" "$filtered_runs_file"
      ;;
    operations/runner-timing)
      telemetry_summary_write_runner_timing "$filtered_file" "$page" "$source_event_count"
      ;;
    agents/prompt-evolution)
      telemetry_summary_write_prompt_evolution "$filtered_file" "$page" "$source_event_count"
      ;;
  esac

  printf 'summary_status=updated\n'
  printf 'slug=%s\n' "$slug"
  printf 'source_event_count=%s\n' "$source_event_count"
  printf 'page=%s\n' "$(relative_to_board "$board_root" "$page")"
}

run_summarize_telemetry() {
  local project_root="$1"
  local board_dir_name="$2"
  local slug="$3"
  local slug_set="$4"
  local window="$5"
  local current_slug

  require_cmd jq || return 1

  if [ -n "$slug_set" ]; then
    case "$slug_set" in
      telemetry-default)
        for current_slug in operations/runner-health operations/runner-timing agents/prompt-evolution; do
          run_summarize_telemetry_slug "$project_root" "$board_dir_name" "$current_slug" "$window"
        done
        ;;
      *)
        printf 'summary_status=blocked\n'
        printf 'reason=unknown_slug_set\n'
        printf 'slug_set=%s\n' "$slug_set"
        ;;
    esac
    return 0
  fi

  if [ -z "$slug" ]; then
    printf 'summary_status=blocked\n'
    printf 'reason=missing_slug\n'
    printf 'source_event_count=0\n'
    return 0
  fi

  run_summarize_telemetry_slug "$project_root" "$board_dir_name" "$slug" "$window"
}

action="${1:-}"
if [ -z "$action" ]; then
  usage
  exit 1
fi
shift || true

dry_run="false"
query_limit="10"
query_include_tickets="true"
query_include_handoffs="true"
query_with_snippets="true"
query_rag="false"
query_synth="false"
query_save_as=""
lint_semantic="false"
wiki_runner_id=""
query_terms_file=""
ingest_slug=""
ingest_no_summary="false"
retrofit_page=""
retrofit_allow_adapter="false"
telemetry_summary_slug=""
telemetry_summary_slug_set=""
telemetry_summary_window="7d"
positionals=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run)
      dry_run="true"
      ;;
    --term)
      shift || true
      if [ -z "${1:-}" ]; then
        echo "Missing value for --term" >&2
        usage
        exit 1
      fi
      [ -n "$query_terms_file" ] || query_terms_file="$(autoflow_mktemp)"
      printf '%s\n' "$1" >> "$query_terms_file"
      ;;
    --limit)
      shift || true
      if [ -z "${1:-}" ]; then
        echo "Missing value for --limit" >&2
        usage
        exit 1
      fi
      query_limit="$1"
      ;;
    --no-tickets)
      query_include_tickets="false"
      ;;
    --no-handoffs)
      query_include_handoffs="false"
      ;;
    --no-snippets)
      query_with_snippets="false"
      ;;
    --rag)
      query_rag="true"
      ;;
    --synth)
      query_synth="true"
      ;;
    --save-as)
      shift || true
      if [ -z "${1:-}" ]; then
        echo "Missing value for --save-as" >&2
        usage
        exit 1
      fi
      query_save_as="$1"
      ;;
    --save-as=*)
      query_save_as="${1#--save-as=}"
      ;;
    --semantic)
      lint_semantic="true"
      ;;
    --runner)
      shift || true
      if [ -z "${1:-}" ]; then
        echo "Missing value for --runner" >&2
        usage
        exit 1
      fi
      wiki_runner_id="$1"
      ;;
    --runner=*)
      wiki_runner_id="${1#--runner=}"
      ;;
    --slug)
      shift || true
      if [ -z "${1:-}" ]; then
        echo "Missing value for --slug" >&2
        usage
        exit 1
      fi
      ingest_slug="$1"
      telemetry_summary_slug="$1"
      ;;
    --slug=*)
      ingest_slug="${1#--slug=}"
      telemetry_summary_slug="${1#--slug=}"
      ;;
    --slug-set)
      shift || true
      if [ -z "${1:-}" ]; then
        echo "Missing value for --slug-set" >&2
        usage
        exit 1
      fi
      telemetry_summary_slug_set="$1"
      ;;
    --slug-set=*)
      telemetry_summary_slug_set="${1#--slug-set=}"
      ;;
    --all-standard-slugs)
      telemetry_summary_slug_set="telemetry-default"
      ;;
    --window)
      shift || true
      if [ -z "${1:-}" ]; then
        echo "Missing value for --window" >&2
        usage
        exit 1
      fi
      telemetry_summary_window="$1"
      ;;
    --window=*)
      telemetry_summary_window="${1#--window=}"
      ;;
    --no-summary)
      ingest_no_summary="true"
      ;;
    --page)
      shift || true
      if [ -z "${1:-}" ]; then
        echo "Missing value for --page" >&2
        usage
        exit 1
      fi
      retrofit_page="$1"
      ;;
    --page=*)
      retrofit_page="${1#--page=}"
      ;;
    --allow-adapter)
      retrofit_allow_adapter="true"
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      positionals+=("$1")
      ;;
  esac
  shift || true
done

project_root_input="${positionals[0]:-.}"
board_dir_name="${positionals[1]:-$(default_board_dir_name)}"
project_root="$(resolve_project_root_or_die "$project_root_input")"

case "$action" in
  update)
    run_update "$project_root" "$board_dir_name" "$dry_run"
    ;;
  lint)
    run_lint "$project_root" "$board_dir_name" "$lint_semantic" "$wiki_runner_id"
    ;;
  query)
    if [ -z "$query_terms_file" ]; then
      query_terms_file="$(autoflow_mktemp)"
    fi
    if ! [[ "$query_limit" =~ ^[0-9]+$ ]] || [ "$query_limit" -lt 1 ]; then
      echo "Invalid --limit value: ${query_limit}" >&2
      exit 1
    fi
    if [ -n "$query_save_as" ] && [ "$query_synth" != "true" ]; then
      echo "--save-as requires --synth" >&2
      exit 1
    fi
    run_query "$project_root" "$board_dir_name" "$query_terms_file" "$query_limit" \
      "$query_include_tickets" "$query_include_handoffs" "$query_with_snippets" \
      "$query_synth" "$wiki_runner_id" "$query_save_as" "$query_rag"
    ;;
  ingest)
    if [ -z "${positionals[2]:-}" ]; then
      echo "Missing source file for ingest" >&2
      usage
      exit 1
    fi
    run_ingest "$project_root" "$board_dir_name" "${positionals[2]}" "$ingest_slug" "$ingest_no_summary" "$wiki_runner_id"
    ;;
  retrofit-frontmatter)
    run_retrofit_frontmatter "$project_root" "$board_dir_name" "$dry_run" "$retrofit_page" "$retrofit_allow_adapter" "$wiki_runner_id"
    ;;
  summarize-telemetry)
    run_summarize_telemetry "$project_root" "$board_dir_name" "$telemetry_summary_slug" "$telemetry_summary_slug_set" "$telemetry_summary_window"
    ;;
  help|-h|--help)
    usage
    ;;
  *)
    echo "Unknown wiki action: ${action}" >&2
    usage
    exit 1
    ;;
esac
