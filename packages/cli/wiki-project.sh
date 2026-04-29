#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/cli-common.sh"
source "$(runtime_scripts_root)/runner-common.sh"

usage() {
  cat <<'EOF' >&2
Usage:
  wiki-project.sh update [project-root] [board-dir-name] [--dry-run]
  wiki-project.sh lint [project-root] [board-dir-name] [--semantic] [--runner RUNNER_ID]
  wiki-project.sh query [project-root] [board-dir-name] --term TEXT [--term TEXT]... [--limit N] [--no-tickets] [--no-snippets] [--no-handoffs] [--synth] [--save-as SLUG] [--runner RUNNER_ID]

Examples:
  wiki-project.sh update /path/to/project
  wiki-project.sh lint /path/to/project .autoflow --semantic
  wiki-project.sh query /path/to/project --term auth --term session --limit 5 --synth
  wiki-project.sh query /path/to/project --term wiki --term lint --synth --save-as wiki-lint-summary

Environment:
  AUTOFLOW_WIKI_LINT_PROMPT_BYTES    Byte cap for the semantic-lint adapter prompt (default 32768).
                                     When the assembled prompt would exceed this, pages are dropped
                                     from the tail and `semantic_truncated=true` plus
                                     `semantic_dropped_pages.<n>=...` are emitted.
  AUTOFLOW_WIKI_LINT_DEBUG_PROMPT_PATH
                                     When set, the assembled adapter prompt is copied to that path
                                     before the adapter is invoked. Used by verifiers to confirm
                                     only changed pages are included.
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

  mv "$tmp" "$file"
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

  case "${agent:-}" in
    ""|manual|shell)
      return 127
      ;;
  esac

  if [ -n "$command_value" ]; then
    AUTOFLOW_PROMPT_FILE="$prompt_file" bash -lc "$command_value" < "$prompt_file" > "$stdout_file" 2> "$stderr_file"
    return $?
  fi

  case "$agent" in
    codex)
      command -v codex >/dev/null 2>&1 || return 127
      cmd=(codex exec --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check -C "$project_root")
      [ -z "$model" ] || cmd+=(-m "$model")
      [ -z "$reasoning" ] || cmd+=(-c "model_reasoning_effort=\"${reasoning}\"")
      cmd+=(-)
      "${cmd[@]}" < "$prompt_file" > "$stdout_file" 2> "$stderr_file"
      ;;
    claude)
      command -v claude >/dev/null 2>&1 || return 127
      cmd=(claude -p --dangerously-skip-permissions --permission-mode bypassPermissions --output-format text)
      [ -z "$model" ] || cmd+=(--model "$model")
      [ -z "$reasoning" ] || cmd+=(--effort "$reasoning")
      cmd+=("$(cat "$prompt_file")")
      "${cmd[@]}" > "$stdout_file" 2> "$stderr_file"
      ;;
    opencode)
      command -v opencode >/dev/null 2>&1 || return 127
      cmd=(opencode run)
      [ -z "$model" ] || cmd+=(--model "$model")
      [ -z "$reasoning" ] || cmd+=(--variant "$reasoning")
      cmd+=("$(cat "$prompt_file")")
      "${cmd[@]}" > "$stdout_file" 2> "$stderr_file"
      ;;
    gemini)
      command -v gemini >/dev/null 2>&1 || return 127
      cmd=(gemini --approval-mode auto_edit --prompt "$(cat "$prompt_file")")
      [ -z "$model" ] || cmd+=(--model "$model")
      "${cmd[@]}" > "$stdout_file" 2> "$stderr_file"
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
      sed -n '1,80p' "$page"
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

  local board_root wiki_root candidates scores sorted synth_results
  local term_count=0 result_count=0 emitted=0

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

  while IFS= read -r file; do
    [ -n "$file" ] || continue
    local file_score=0 hits term
    while IFS= read -r term; do
      [ -n "$term" ] || continue
      hits="$(grep -Fic -- "$term" "$file" 2>/dev/null || printf '0')"
      hits="${hits//[!0-9]/}"
      [ -n "$hits" ] || hits=0
      file_score=$((file_score + hits))
    done < "$terms_file"
    if [ "$file_score" -gt 0 ]; then
      printf '%s\t%s\n' "$file_score" "$file" >> "$scores"
    fi
  done < "$candidates"

  if [ -s "$scores" ]; then
    sort -t$'\t' -k1,1 -nr "$scores" > "$sorted"
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

  while IFS=$'\t' read -r score file; do
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
    {
      printf 'path=%s\n' "$rel"
      printf 'title=%s\n' "$title"
      printf 'kind=%s\n' "$kind"
      printf 'score=%s\n' "$score"
    } >> "$synth_results"

    [ "$with_snippets" = "true" ] || continue

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
  replace_managed_section "${wiki_root}/index.md" "work-map" "$index_body" "$index_default"
  replace_managed_section "${wiki_root}/log.md" "derived-timeline" "$log_body" "$log_default"
  replace_managed_section "${wiki_root}/project-overview.md" "project-summary" "$overview_body" "$overview_default"

  printf 'status=updated\n'
  printf 'project_root=%s\n' "$project_root"
  printf 'board_root=%s\n' "$board_root"
  printf 'wiki_root=%s\n' "$wiki_root"
  printf 'ticket_done_count=%s\n' "$done_count"
  printf 'reject_count=%s\n' "$reject_count"
  printf 'log_count=%s\n' "$log_count"
  printf 'handoff_count=%s\n' "$handoff_count"
  printf 'updated_file.1=%s\n' "${wiki_root}/index.md"
  printf 'updated_file.2=%s\n' "${wiki_root}/log.md"
  printf 'updated_file.3=%s\n' "${wiki_root}/project-overview.md"
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
  local file rel stem content stems_file all_stems_file link_target page_first_line
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

    case "$stem" in
      index)
        continue
        ;;
    esac

    if [ "$(basename "$file")" = "README.md" ]; then
      continue
    fi

    if ! printf '%s\n' "$content" | grep -Fq "[[${stem}]]" && \
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
query_synth="false"
query_save_as=""
lint_semantic="false"
wiki_runner_id=""
query_terms_file=""
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
      "$query_synth" "$wiki_runner_id" "$query_save_as"
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
