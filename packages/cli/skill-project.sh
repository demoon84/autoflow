#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/cli-common.sh"

usage() {
  cat <<'EOF' >&2
Usage:
  skill-project.sh create [project-root] [board-dir-name] --from-ticket <ticket-id-or-path>
  skill-project.sh match [project-root] [board-dir-name] --keywords "<text>" [--limit N]
  skill-project.sh update-stats [project-root] [board-dir-name] <skill_NNN.md|skill_NNN> --result pass|fail
EOF
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

yaml_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

normalize_words() {
  local input="${1-}"

  if [ $# -gt 0 ]; then
    printf '%s' "$input"
  else
    cat
  fi \
    | sed -E 's/([[:lower:][:digit:]])([[:upper:]])/\1 \2/g' \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/ /g' \
    | awk '
        {
          for (i = 1; i <= NF; i++) {
            if (length($i) >= 3) {
              print $i
            }
          }
        }
      '
}

unique_lines() {
  awk 'NF && !seen[$0]++'
}

board_rel_path() {
  local board_root="$1"
  local path="$2"

  case "$path" in
    "$board_root"/*) printf '%s' "${path#"$board_root"/}" ;;
    *) printf '%s' "$path" ;;
  esac
}

skills_root_path() {
  local project_root="$1"
  local board_dir_name="$2"

  printf '%s/wiki/skills' "$(board_root_path "$project_root" "$board_dir_name")"
}

skills_template_path() {
  local project_root="$1"

  printf '%s/scaffold/board/wiki/skills' "$project_root"
}

ensure_skills_dir() {
  mkdir -p "$1"
}

next_skill_file() {
  local skills_root="$1"
  local next_id

  next_id="$(
    find "$skills_root" -maxdepth 1 -type f -name 'skill_*.md' 2>/dev/null \
      | sed -E 's#.*/skill_([0-9]+)\.md#\1#' \
      | sort -n \
      | tail -1
  )"
  next_id="${next_id:-0}"
  next_id=$((10#$next_id + 1))
  printf '%s/skill_%03d.md' "$skills_root" "$next_id"
}

resolve_ticket_file() {
  local board_root="$1"
  local ref="$2"
  local normalized id candidate

  normalized="$ref"
  case "$normalized" in
    /*)
      [ -f "$normalized" ] && printf '%s' "$normalized" && return 0
      ;;
    */*)
      candidate="${board_root}/${normalized}"
      [ -f "$candidate" ] && printf '%s' "$candidate" && return 0
      ;;
  esac

  id="$(printf '%s' "$ref" | sed -nE 's/.*tickets_?([0-9]+).*/\1/p')"
  [ -n "$id" ] || return 1
  id="$(printf '%03d' "$((10#$id))")"

  candidate="$(find "$board_root/tickets" -type f -name "tickets_${id}.md" | sort | head -1)"
  [ -n "$candidate" ] || return 1
  printf '%s' "$candidate"
}

ticket_verify_file() {
  local ticket_file="$1"
  local dir id candidate

  dir="$(cd "$(dirname "$ticket_file")" && pwd)"
  id="$(printf '%s' "$(basename "$ticket_file")" | sed -E 's/^tickets_([0-9]+)\.md$/\1/')"
  candidate="${dir}/verify_${id}.md"
  [ -f "$candidate" ] && printf '%s' "$candidate"
}

ticket_prd_file() {
  local board_root="$1"
  local ticket_file="$2"
  local prd_key candidate

  prd_key="$(extract_md_field "$ticket_file" "PRD Key")"
  [ -n "$prd_key" ] || return 0
  candidate="$(find "$board_root/tickets" -type f -path "*/${prd_key}/${prd_key}.md" | sort | head -1)"
  [ -n "$candidate" ] && printf '%s' "$candidate"
}

extract_list_items_from_section() {
  local file="$1"
  local section="$2"

  awk -v section="$section" '
    $0 == section { in_section=1; next }
    /^## / && in_section { exit }
    in_section && /^- \[[ x]\]/ {
      line=$0
      sub(/^- \[[ x]\][[:space:]]*/, "", line)
      print line
    }
  ' "$file"
}

extract_scalar_from_section() {
  local file="$1"
  local section="$2"
  local field="$3"

  awk -v section="$section" -v field="$field" '
    $0 == section { in_section=1; next }
    /^## / && in_section { exit }
    in_section {
      prefix="- " field ":"
      if (index($0, prefix) == 1) {
        line=$0
        sub("^[-] " field ":[[:space:]]*", "", line)
        print line
        exit
      }
    }
  ' "$file" 2>/dev/null || true
}

build_keywords_yaml() {
  local ticket_file="$1"
  local goal title allowed_paths keywords

  title="$(extract_md_field "$ticket_file" "Title")"
  goal="$(extract_md_field "$ticket_file" "Goal")"
  allowed_paths="$(awk '/^## Allowed Paths/{in_section=1; next} /^## / && in_section{exit} in_section && /^- `/{gsub(/^- `|`$/, "", $0); print $0}' "$ticket_file")"
  keywords="$(
    {
      printf '%s\n' "$title"
      printf '%s\n' "$goal"
      printf '%s\n' "$allowed_paths"
    } | normalize_words | unique_lines | head -12
  )"

  if [ -z "$keywords" ]; then
    printf '  - "autoflow"\n'
    return 0
  fi

  while IFS= read -r keyword; do
    [ -n "$keyword" ] || continue
    printf '  - "%s"\n' "$(yaml_escape "$keyword")"
  done <<EOF
$keywords
EOF
}

build_applies_to_yaml() {
  local ticket_file="$1"
  local allowed_paths

  allowed_paths="$(awk '/^## Allowed Paths/{in_section=1; next} /^## / && in_section{exit} in_section && /^- `/{line=$0; sub(/^- `/, "", line); sub(/`$/, "", line); print line}' "$ticket_file")"
  if [ -z "$allowed_paths" ]; then
    printf '  - "general"\n'
    return 0
  fi

  while IFS= read -r allowed_path; do
    [ -n "$allowed_path" ] || continue
    printf '  - "%s"\n' "$(yaml_escape "$allowed_path")"
  done <<EOF
$allowed_paths
EOF
}

render_skill_file() {
  local output_file="$1"
  local board_root="$2"
  local ticket_file="$3"
  local verify_file="$4"
  local prd_file="$5"
  local now title goal summary verify_command created_from
  local trigger_text pitfalls_text

  now="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  title="$(extract_md_field "$ticket_file" "Title")"
  goal="$(extract_md_field "$ticket_file" "Goal")"
  summary="$(extract_scalar_from_section "$ticket_file" "## Result" "Summary")"
  verify_command="$(extract_scalar_from_section "$verify_file" "## Command" "Command")"
  [ -n "$verify_command" ] || verify_command="$(extract_scalar_from_section "$prd_file" "## Verification" "Command")"
  created_from="$(board_rel_path "$board_root" "$ticket_file")"
  trigger_text="$goal"
  [ -n "$trigger_text" ] || trigger_text="$title"
  pitfalls_text="$(extract_scalar_from_section "$ticket_file" "## Result" "Remaining risk")"
  [ -n "$pitfalls_text" ] || pitfalls_text="Allowed Paths 밖으로 확장하지 말고, 완료 후 추출 실패가 finalization을 막지 않게 유지한다."

  {
    printf -- '---\n'
    printf 'title: "%s"\n' "$(yaml_escape "$title")"
    printf 'pattern_type: ticket_owner_pattern\n'
    printf 'applies_to:\n'
    build_applies_to_yaml "$ticket_file"
    printf 'keywords:\n'
    build_keywords_yaml "$ticket_file"
    printf 'success_count: 0\n'
    printf 'failure_count: 0\n'
    printf 'last_used_at: ""\n'
    printf 'created_from: "%s"\n' "$(yaml_escape "$created_from")"
    printf 'created_at: "%s"\n' "$now"
    printf 'enabled: true\n'
    printf -- '---\n\n'
    printf '# %s\n\n' "$title"
    printf '## Trigger\n\n'
    printf -- '- Reuse when: %s\n' "$trigger_text"
    printf -- '- Source ticket: `%s`\n\n' "$created_from"
    printf '## Recommended Procedure\n\n'
    extract_list_items_from_section "$ticket_file" "## Done When" | head -5 | awk '{ printf "- %s\n", $0 }'
    printf '\n## Pitfalls\n\n'
    printf -- '- %s\n\n' "$pitfalls_text"
    printf '## Verification Pattern\n\n'
    if [ -n "$verify_command" ]; then
      printf -- '- Command: `%s`\n\n' "$verify_command"
    else
      printf -- '- Command: manual review required\n\n'
    fi
    printf '## Source Evidence\n\n'
    printf -- '- Ticket: `%s`\n' "$(board_rel_path "$board_root" "$ticket_file")"
    [ -z "$prd_file" ] || printf -- '- PRD: `%s`\n' "$(board_rel_path "$board_root" "$prd_file")"
    [ -z "$verify_file" ] || printf -- '- Verification: `%s`\n' "$(board_rel_path "$board_root" "$verify_file")"
    [ -z "$summary" ] || printf -- '- Result summary: %s\n' "$summary"
  } > "$output_file"
}

match_score() {
  local query_file="$1"
  local candidate_file="$2"
  local keywords title body applies score

  keywords="$(awk '
    /^keywords:/ { in_keywords=1; next }
    in_keywords && /^  - / { line=$0; sub(/^  - "/, "", line); sub(/"$/, "", line); print line; next }
    in_keywords { in_keywords=0 }
  ' "$candidate_file")"
  title="$(extract_frontmatter_value "$candidate_file" "title" | sed -E 's/^"|"$//g')"
  applies="$(awk '
    /^applies_to:/ { in_section=1; next }
    in_section && /^  - / { line=$0; sub(/^  - "/, "", line); sub(/"$/, "", line); print line; next }
    in_section { in_section=0 }
  ' "$candidate_file")"
  body="$(sed -n '/^## Trigger/,$p' "$candidate_file")"
  score=0

  while IFS= read -r token; do
    [ -n "$token" ] || continue
    printf '%s\n' "$keywords" | normalize_words | grep -qx "$token" && score=$((score + 4))
    printf '%s\n' "$title" | normalize_words | grep -qx "$token" && score=$((score + 3))
    printf '%s\n' "$applies" | normalize_words | grep -qx "$token" && score=$((score + 2))
    printf '%s\n' "$body" | normalize_words | grep -qx "$token" && score=$((score + 1))
  done < "$query_file"

  printf '%s' "$score"
}

run_create() {
  local project_root="$1"
  local board_dir_name="$2"
  local ticket_ref="$3"
  local board_root skills_root ticket_file verify_file prd_file skill_file

  board_root="$(board_root_path "$project_root" "$board_dir_name")"
  skills_root="$(skills_root_path "$project_root" "$board_dir_name")"
  ensure_skills_dir "$skills_root"
  ticket_file="$(resolve_ticket_file "$board_root" "$ticket_ref" || true)"
  [ -n "$ticket_file" ] || { echo "Ticket not found: $ticket_ref" >&2; exit 1; }

  verify_file="$(ticket_verify_file "$ticket_file")"
  prd_file="$(ticket_prd_file "$board_root" "$ticket_file")"
  skill_file="$(next_skill_file "$skills_root")"
  render_skill_file "$skill_file" "$board_root" "$ticket_file" "$verify_file" "$prd_file"

  printf 'status=ok\n'
  printf 'skill_file=%s\n' "$skill_file"
  printf 'skill_id=%s\n' "$(basename "$skill_file")"
  printf 'created_from=%s\n' "$(board_rel_path "$board_root" "$ticket_file")"
}

run_match() {
  local project_root="$1"
  local board_dir_name="$2"
  local keywords_input="$3"
  local limit="$4"
  local skills_root query_file match_file file score count

  skills_root="$(skills_root_path "$project_root" "$board_dir_name")"
  ensure_skills_dir "$skills_root"
  query_file="$(autoflow_mktemp)"
  match_file="$(autoflow_mktemp)"
  printf '%s\n' "$keywords_input" | normalize_words | unique_lines > "$query_file"

  : > "$match_file"
  find "$skills_root" -maxdepth 1 -type f -name 'skill_*.md' | sort | while IFS= read -r file; do
    score="$(match_score "$query_file" "$file")"
    [ "$score" -gt 0 ] || continue
    printf '%s\t%s\t%s\n' "$score" "$(basename "$file")" "$(extract_frontmatter_value "$file" "title" | sed -E 's/^"|"$//g')" >> "$match_file"
  done

  printf 'status=ok\n'
  if [ ! -s "$match_file" ]; then
    printf 'match_count=0\n'
    return 0
  fi

  count=0
  sort -t "$(printf '\t')" -k1,1nr -k2,2 "$match_file" | while IFS="$(printf '\t')" read -r score skill_id title; do
    count=$((count + 1))
    if [ "$count" -gt "$limit" ]; then
      break
    fi
    printf 'match.%s.score=%s\n' "$count" "$score"
    printf 'match.%s.skill_id=%s\n' "$count" "$skill_id"
    printf 'match.%s.title=%s\n' "$count" "$title"
  done
  printf 'match_count=%s\n' "$(sort -t "$(printf '\t')" -k1,1nr -k2,2 "$match_file" | head -n "$limit" | wc -l | tr -d '[:space:]')"
}

run_update_stats() {
  local project_root="$1"
  local board_dir_name="$2"
  local skill_ref="$3"
  local result="$4"
  local skills_root skill_file tmp_file now

  skills_root="$(skills_root_path "$project_root" "$board_dir_name")"
  case "$skill_ref" in
    /*) skill_file="$skill_ref" ;;
    *.md) skill_file="${skills_root}/$(basename "$skill_ref")" ;;
    *) skill_file="${skills_root}/$(basename "$skill_ref").md" ;;
  esac
  [ -f "$skill_file" ] || { echo "Skill not found: $skill_ref" >&2; exit 1; }

  now="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  tmp_file="$(autoflow_mktemp)"
  awk -v result="$result" -v now="$now" '
    BEGIN { in_frontmatter=0 }
    NR == 1 && $0 == "---" { in_frontmatter=1; print; next }
    in_frontmatter && $0 == "---" { in_frontmatter=0; print; next }
    in_frontmatter && result == "pass" && $0 ~ /^success_count:/ {
      sub(/^success_count:[[:space:]]*/, "", $0)
      print "success_count: " ($0 + 1)
      next
    }
    in_frontmatter && result == "fail" && $0 ~ /^failure_count:/ {
      sub(/^failure_count:[[:space:]]*/, "", $0)
      print "failure_count: " ($0 + 1)
      next
    }
    in_frontmatter && $0 ~ /^last_used_at:/ {
      print "last_used_at: \"" now "\""
      next
    }
    { print }
  ' "$skill_file" > "$tmp_file"
  mv "$tmp_file" "$skill_file"

  printf 'status=ok\n'
  printf 'skill_file=%s\n' "$skill_file"
  printf 'skill_id=%s\n' "$(basename "$skill_file")"
  printf 'success_count=%s\n' "$(extract_frontmatter_value "$skill_file" "success_count")"
  printf 'failure_count=%s\n' "$(extract_frontmatter_value "$skill_file" "failure_count")"
  printf 'last_used_at=%s\n' "$(extract_frontmatter_value "$skill_file" "last_used_at" | sed -E 's/^"|"$//g')"
}

subcmd="${1:-}"
[ -n "$subcmd" ] || { usage; exit 1; }
shift || true

project_root_input="."
board_dir_name="$(default_board_dir_name)"
if [ $# -gt 0 ] && [ "${1#-}" = "$1" ]; then
  project_root_input="$1"
  shift || true
fi
if [ $# -gt 0 ] && [ "${1#-}" = "$1" ]; then
  board_dir_name="$1"
  shift || true
fi
project_root="$(resolve_project_root_or_die "$project_root_input")"

case "$subcmd" in
  create)
    ticket_ref=""
    while [ $# -gt 0 ]; do
      case "$1" in
        --from-ticket)
          ticket_ref="${2:-}"
          shift 2
          ;;
        *)
          echo "Unknown argument: $1" >&2
          usage
          exit 1
          ;;
      esac
    done
    [ -n "$ticket_ref" ] || { usage; exit 1; }
    run_create "$project_root" "$board_dir_name" "$ticket_ref"
    ;;
  match)
    keywords_input=""
    limit=5
    while [ $# -gt 0 ]; do
      case "$1" in
        --keywords)
          keywords_input="${2:-}"
          shift 2
          ;;
        --limit)
          limit="${2:-5}"
          shift 2
          ;;
        *)
          echo "Unknown argument: $1" >&2
          usage
          exit 1
          ;;
      esac
    done
    [ -n "$keywords_input" ] || { usage; exit 1; }
    run_match "$project_root" "$board_dir_name" "$keywords_input" "$limit"
    ;;
  update-stats)
    skill_ref="${1:-}"
    shift || true
    result=""
    while [ $# -gt 0 ]; do
      case "$1" in
        --result)
          result="${2:-}"
          shift 2
          ;;
        *)
          echo "Unknown argument: $1" >&2
          usage
          exit 1
          ;;
      esac
    done
    case "$result" in
      pass|fail) ;;
      *) usage; exit 1 ;;
    esac
    [ -n "$skill_ref" ] || { usage; exit 1; }
    run_update_stats "$project_root" "$board_dir_name" "$skill_ref" "$result"
    ;;
  *)
    echo "Unknown skill command: $subcmd" >&2
    usage
    exit 1
    ;;
esac
