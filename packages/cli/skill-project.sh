#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/cli-common.sh"

# Phase 1 (prd_162): Hermes-pattern skill infrastructure.
# - Dual storage: in-repo skills/ (curated) + skills-local/ (agent-created).
# - Folder-unit: <category>/<name>/SKILL.md.
# - Frontmatter standard: name, description, pattern_type, applies_to.module,
#   applies_to.keywords, pinned, created_from.prd, created_from.ticket, created_at.
# - Validator caps: name <=64, description <=1024, content <=100KB, file <=1MiB.
# - .usage.json sidecar at skills-local/.usage.json (atomic write, best-effort).
# - Pinned skills bypass lifecycle automation (archive refuses pinned).
# Legacy flat skill_NNN.md (prd_160) remain readable by list/view/match.

NAME_MAX=64
DESCRIPTION_MAX=1024
CONTENT_MAX=102400        # 100KB
FILE_MAX=1048576          # 1MiB

usage() {
  cat <<'EOF' >&2
Usage:
  skill-project.sh create [project-root] [board-dir-name] --from-ticket <ticket-id-or-path>
                          [--name <slug>] [--category <name>] [--pattern-type <type>]
  skill-project.sh list [project-root] [board-dir-name] [--include-archived]
  skill-project.sh view [project-root] [board-dir-name] <name|category/name|path|skill_NNN>
  skill-project.sh validate [project-root] [board-dir-name] <name|category/name|path|skill_NNN>
  skill-project.sh archive [project-root] [board-dir-name] <name|category/name>
  skill-project.sh match [project-root] [board-dir-name] --keywords "<text>" [--limit N]
  skill-project.sh update-stats [project-root] [board-dir-name] <skill_id-or-path> --result pass|fail
  skill-project.sh scan [project-root] [board-dir-name] <skill-file> [--source <text>]
  skill-project.sh import [project-root] [board-dir-name] <agentskills-url-or-file> [--name <slug>] [--category <name>]
  skill-project.sh export [project-root] [board-dir-name] <name|category/name|path|skill_NNN>
  skill-project.sh cluster-detect [project-root] [board-dir-name] [--threshold-percent N]
  skill-project.sh meta-extract [project-root] [board-dir-name] --cluster <skill,skill,...> [--name <slug>] [--category <name>]
  skill-project.sh apply [project-root] [board-dir-name] --keywords "<text>" [--deterministic]
  skill-project.sh metrics [project-root] [board-dir-name] [--window-days N]
  skill-project.sh curator-run [project-root] [board-dir-name] [--once] [--idle] [--now <iso8601>]
  skill-project.sh curator-status [project-root] [board-dir-name]
  skill-project.sh auto-extract [project-root] [board-dir-name] --from-ticket <ticket-id-or-path>
                                --pattern-type <type> [--name <slug>] [--category <name>]
EOF
}

# ---------- generic helpers ----------

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

# Lowercase-hyphen slug, capped to NAME_MAX.
slugify_name() {
  local input="$1"
  local out
  out="$(printf '%s' "$input" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//')"
  if [ -z "$out" ]; then
    out="skill-$(date -u +%s)"
  fi
  if [ ${#out} -gt $NAME_MAX ]; then
    out="${out:0:$NAME_MAX}"
    out="$(printf '%s' "$out" | sed -E 's/-+$//')"
  fi
  printf '%s' "$out"
}

truncate_text() {
  local input="$1"
  local max="$2"
  if [ ${#input} -le "$max" ]; then
    printf '%s' "$input"
  else
    printf '%s' "${input:0:$max}"
  fi
}

# Atomic write: takes content from stdin, writes to $1 via tmpfile + mv.
atomic_write_file() {
  local target="$1"
  local tmp
  tmp="$(autoflow_mktemp)"
  cat > "$tmp"
  mkdir -p "$(dirname "$target")"
  mv "$tmp" "$target"
}

next_check_file_path() {
  local board_root="$1"
  local check_dir="${board_root}/tickets/check"
  local max_id id file

  mkdir -p "$check_dir"
  max_id=0
  for file in "$check_dir"/check_*.md; do
    [ -e "$file" ] || continue
    id="$(basename "$file" .md | sed -nE 's/^check_([0-9]+)$/\1/p')"
    case "$id" in
      ''|*[!0-9]*) continue ;;
    esac
    id=$((10#$id))
    [ "$id" -gt "$max_id" ] && max_id="$id"
  done
  printf '%s/check_%03d.md' "$check_dir" "$((max_id + 1))"
}

write_security_check_file() {
  local board_root="$1"
  local source_ref="$2"
  local issues="$3"
  local scan_file="$4"
  local check_file now

  check_file="$(next_check_file_path "$board_root")"
  now="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  {
    printf -- '---\n'
    printf 'title: "Skill security scan blocked"\n'
    printf 'created_at: "%s"\n' "$now"
    printf 'event_type: "skill_security_scan_blocked"\n'
    printf 'prd_key: ""\n'
    printf 'ticket_id: ""\n'
    printf 'source: "skill-project.sh"\n'
    printf -- '---\n\n'
    printf '## What Happened\n\n'
    printf -- '- Skill creation/import was refused because the security scan detected unsafe content.\n'
    printf -- '- Source: `%s`\n\n' "$source_ref"
    printf '## Evidence\n\n'
    printf -- '- Scan file: `%s`\n' "$scan_file"
    printf -- '- Issues: `%s`\n\n' "$issues"
    printf '## Recommended Human Action\n\n'
    printf -- '- Review the blocked skill content and only retry with sanitized instructions or secrets removed.\n\n'
    printf '## Status\n\n'
    printf -- '- [ ] 사람 확인 완료\n'
  } > "$check_file"
  printf '%s' "$check_file"
}

skill_security_scan_file() {
  local project_root="$1"
  local board_dir_name="$2"
  local scan_file="$3"
  local source_ref="${4:-$scan_file}"
  local board_root issues check_file

  board_root="$(board_root_path "$project_root" "$board_dir_name")"
  case "${AUTOFLOW_SKILL_SECURITY_SCAN_ENABLED:-1}" in
    0|false|off|no|FALSE|OFF|NO)
      printf 'status=ok\n'
      printf 'security_scan=disabled\n'
      return 0
      ;;
  esac

  [ -f "$scan_file" ] || { echo "Skill file not found: $scan_file" >&2; exit 1; }
  issues=""
  if grep -Eiq 'rm[[:space:]]+-rf[[:space:]]+/([[:space:]]|$)|:\(\)[[:space:]]*\{[[:space:]]*:\|:&[[:space:]]*\};:|curl[^|]{0,160}\|[[:space:]]*(sh|bash)|wget[^|]{0,160}\|[[:space:]]*(sh|bash)' "$scan_file"; then
    issues="${issues}malicious_command_pattern;"
  fi
  if grep -Eiq 'AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|(api[_-]?key|password|token|secret)[^A-Za-z0-9]{0,8}[:=][^[:space:]]{8,}' "$scan_file"; then
    issues="${issues}secret_like_value;"
  fi

  if [ -n "$issues" ]; then
    check_file="$(write_security_check_file "$board_root" "$source_ref" "$issues" "$scan_file")"
    printf 'status=fail\n'
    printf 'reason=security_scan_blocked\n'
    printf 'security_scan=blocked\n'
    printf 'issues=%s\n' "$issues"
    printf 'check_file=%s\n' "$check_file"
    return 6
  fi

  printf 'status=ok\n'
  printf 'security_scan=passed\n'
}

# ---------- skill root paths ----------

# Curated (in-repo) skill root. Hosts both legacy flat skill_NNN.md and
# new folder-unit <category>/<name>/SKILL.md.
inrepo_skills_root_path() {
  local project_root="$1"
  local board_dir_name="$2"
  printf '%s/wiki/skills' "$(board_root_path "$project_root" "$board_dir_name")"
}

# Agent-created (lifecycle-managed) skill root.
agent_skills_root_path() {
  local project_root="$1"
  local board_dir_name="$2"
  printf '%s/wiki/skills-local' "$(board_root_path "$project_root" "$board_dir_name")"
}

agent_archive_root_path() {
  local project_root="$1"
  local board_dir_name="$2"
  printf '%s/.archive' "$(agent_skills_root_path "$project_root" "$board_dir_name")"
}

usage_json_path() {
  local project_root="$1"
  local board_dir_name="$2"
  printf '%s/.usage.json' "$(agent_skills_root_path "$project_root" "$board_dir_name")"
}

ensure_dir() { mkdir -p "$1"; }

# ---------- ticket lookup (used by create) ----------

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

ticket_keyword_list() {
  local ticket_file="$1"
  local title goal allowed_paths

  title="$(extract_md_field "$ticket_file" "Title")"
  goal="$(extract_md_field "$ticket_file" "Goal")"
  allowed_paths="$(awk '/^## Allowed Paths/{in_section=1; next} /^## / && in_section{exit} in_section && /^- `/{gsub(/^- `|`$/, "", $0); print $0}' "$ticket_file")"
  {
    printf '%s\n' "$title"
    printf '%s\n' "$goal"
    printf '%s\n' "$allowed_paths"
  } | normalize_words | unique_lines | head -12
}

# ---------- usage.json sidecar (python3-backed, atomic, fault-tolerant) ----------

usage_record_event() {
  # $1=usage_path  $2=key (category/name)  $3=event (view|pass|fail)
  local usage_file="$1"
  local key="$2"
  local event="$3"
  local now
  now="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

  command -v python3 >/dev/null 2>&1 || return 0

  python3 - "$usage_file" "$key" "$event" "$now" <<'PY' 2>/dev/null || true
import json, os, sys, tempfile

usage_path, key, event, now = sys.argv[1:5]
data = {}
if os.path.exists(usage_path):
    try:
        with open(usage_path, "r", encoding="utf-8") as fh:
            loaded = json.load(fh)
        if isinstance(loaded, dict):
            data = loaded
    except Exception:
        # broken sidecar -> start fresh; do not block CLI
        data = {}

entry = data.get(key) if isinstance(data.get(key), dict) else {}
entry.setdefault("view_count", 0)
entry.setdefault("success_count", 0)
entry.setdefault("failure_count", 0)
entry.setdefault("last_viewed_at", "")
entry.setdefault("last_used_at", "")

if event == "view":
    entry["view_count"] = int(entry.get("view_count", 0) or 0) + 1
    entry["last_viewed_at"] = now
elif event == "pass":
    entry["success_count"] = int(entry.get("success_count", 0) or 0) + 1
    entry["last_used_at"] = now
elif event == "fail":
    entry["failure_count"] = int(entry.get("failure_count", 0) or 0) + 1
    entry["last_used_at"] = now
elif event == "register":
    pass
else:
    sys.exit(0)

data[key] = entry

os.makedirs(os.path.dirname(usage_path), exist_ok=True)
fd, tmp = tempfile.mkstemp(prefix=".usage.", dir=os.path.dirname(usage_path))
try:
    with os.fdopen(fd, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2, sort_keys=True)
        fh.write("\n")
    os.replace(tmp, usage_path)
except Exception:
    try: os.unlink(tmp)
    except Exception: pass
PY
}

usage_get_field() {
  # $1=usage_path  $2=key  $3=field
  local usage_file="$1"
  local key="$2"
  local field="$3"

  command -v python3 >/dev/null 2>&1 || { printf ''; return 0; }
  python3 - "$usage_file" "$key" "$field" <<'PY' 2>/dev/null || printf ''
import json, os, sys
usage_path, key, field = sys.argv[1:4]
if not os.path.exists(usage_path):
    sys.exit(0)
try:
    with open(usage_path, "r", encoding="utf-8") as fh:
        data = json.load(fh)
except Exception:
    sys.exit(0)
if not isinstance(data, dict):
    sys.exit(0)
entry = data.get(key) or {}
if not isinstance(entry, dict):
    sys.exit(0)
val = entry.get(field, "")
print(val)
PY
}

# ---------- folder skill rendering ----------

build_keywords_yaml_inline() {
  # Emits indented `    - "kw"` lines (4-space indent for nested under applies_to.keywords).
  local ticket_file="$1"
  local keywords
  keywords="$(ticket_keyword_list "$ticket_file")"
  if [ -z "$keywords" ]; then
    printf '    - "autoflow"\n'
    return 0
  fi
  while IFS= read -r keyword; do
    [ -n "$keyword" ] || continue
    printf '    - "%s"\n' "$(yaml_escape "$keyword")"
  done <<EOF
$keywords
EOF
}

build_module_value_inline() {
  # Picks the first allowed path as the module value, fallback "general".
  local ticket_file="$1"
  local first_path
  first_path="$(awk '/^## Allowed Paths/{in_section=1; next} /^## / && in_section{exit} in_section && /^- `/{line=$0; sub(/^- `/, "", line); sub(/`$/, "", line); print line; exit}' "$ticket_file")"
  if [ -z "$first_path" ]; then
    printf 'general'
  else
    printf '%s' "$first_path"
  fi
}

derive_skill_name() {
  # Use ticket Title; fallback to ticket basename.
  local ticket_file="$1"
  local title
  title="$(extract_md_field "$ticket_file" "Title")"
  if [ -z "$title" ]; then
    title="$(basename "$ticket_file" .md)"
  fi
  slugify_name "$title"
}

derive_unique_skill_dir() {
  local category_root="$1"
  local base_name="$2"
  local candidate="${category_root}/${base_name}"
  local i=2
  while [ -e "$candidate" ]; do
    candidate="${category_root}/${base_name}-${i}"
    i=$((i + 1))
  done
  printf '%s' "$candidate"
}

render_folder_skill_file() {
  local skill_md="$1"
  local board_root="$2"
  local ticket_file="$3"
  local verify_file="$4"
  local prd_file="$5"
  local skill_name="$6"
  local pattern_type="$7"

  local now title goal summary verify_command pitfalls_text
  local description prd_id ticket_id

  now="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  title="$(extract_md_field "$ticket_file" "Title")"
  goal="$(extract_md_field "$ticket_file" "Goal")"
  summary="$(extract_scalar_from_section "$ticket_file" "## Result" "Summary")"
  verify_command="$(extract_scalar_from_section "$verify_file" "## Command" "Command")"
  [ -n "$verify_command" ] || verify_command="$(extract_scalar_from_section "$prd_file" "## Verification" "Command")"
  pitfalls_text="$(extract_scalar_from_section "$ticket_file" "## Result" "Remaining risk")"
  [ -n "$pitfalls_text" ] || pitfalls_text="Allowed Paths 밖으로 확장하지 말고, 추출 실패가 finalization을 막지 않게 유지한다."

  description="${goal:-$title}"
  description="$(truncate_text "$description" $DESCRIPTION_MAX)"

  prd_id="$(extract_md_field "$ticket_file" "PRD Key")"
  ticket_id="$(extract_md_field "$ticket_file" "ID")"
  [ -n "$ticket_id" ] || ticket_id="$(basename "$ticket_file" .md)"

  ensure_dir "$(dirname "$skill_md")"
  {
    printf -- '---\n'
    printf 'name: "%s"\n' "$(yaml_escape "$skill_name")"
    printf 'description: "%s"\n' "$(yaml_escape "$description")"
    printf 'pattern_type: %s\n' "$pattern_type"
    printf 'applies_to:\n'
    printf '  module: "%s"\n' "$(yaml_escape "$(build_module_value_inline "$ticket_file")")"
    printf '  keywords:\n'
    build_keywords_yaml_inline "$ticket_file"
    printf 'pinned: false\n'
    printf 'created_from:\n'
    if [ -n "$prd_id" ]; then
      printf '  prd: "%s"\n' "$(yaml_escape "$prd_id")"
    else
      printf '  prd: null\n'
    fi
    printf '  ticket: "%s"\n' "$(yaml_escape "$ticket_id")"
    printf 'created_at: "%s"\n' "$now"
    printf -- '---\n\n'
    printf '# %s\n\n' "${title:-$skill_name}"
    printf '## Trigger\n\n'
    printf -- '- Reuse when: %s\n' "${goal:-$title}"
    printf -- '- Source ticket: `%s`\n\n' "$(board_rel_path "$board_root" "$ticket_file")"
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
  } > "$skill_md"
}

# ---------- subcommand: create ----------

run_create() {
  local project_root="$1"
  local board_dir_name="$2"
  local ticket_ref="$3"
  local override_name="$4"
  local override_category="$5"
  local override_pattern_type="$6"

  local board_root agent_root inrepo_root ticket_file verify_file prd_file
  local category pattern_type skill_name skill_dir skill_md usage_file rel_path

  board_root="$(board_root_path "$project_root" "$board_dir_name")"
  agent_root="$(agent_skills_root_path "$project_root" "$board_dir_name")"
  inrepo_root="$(inrepo_skills_root_path "$project_root" "$board_dir_name")"
  ensure_dir "$agent_root"
  ensure_dir "$inrepo_root"

  ticket_file="$(resolve_ticket_file "$board_root" "$ticket_ref" || true)"
  [ -n "$ticket_file" ] || { echo "Ticket not found: $ticket_ref" >&2; exit 1; }

  verify_file="$(ticket_verify_file "$ticket_file" || true)"
  prd_file="$(ticket_prd_file "$board_root" "$ticket_file" || true)"

  pattern_type="${override_pattern_type:-ticket_completion}"
  category="${override_category:-ticket-completion}"
  category="$(slugify_name "$category")"
  if [ -n "$override_name" ]; then
    skill_name="$(slugify_name "$override_name")"
  else
    skill_name="$(derive_skill_name "$ticket_file")"
  fi

  ensure_dir "${agent_root}/${category}"
  skill_dir="$(derive_unique_skill_dir "${agent_root}/${category}" "$skill_name")"
  skill_name="$(basename "$skill_dir")"
  skill_md="${skill_dir}/SKILL.md"

  render_folder_skill_file "$skill_md" "$board_root" "$ticket_file" "$verify_file" "$prd_file" "$skill_name" "$pattern_type"
  if ! scan_output="$(skill_security_scan_file "$project_root" "$board_dir_name" "$skill_md" "create:${ticket_ref}" 2>&1)"; then
    rm -rf "$skill_dir"
    printf '%s\n' "$scan_output"
    exit 6
  fi

  usage_file="$(usage_json_path "$project_root" "$board_dir_name")"
  usage_record_event "$usage_file" "${category}/${skill_name}" "register" || true

  rel_path="$(board_rel_path "$board_root" "$skill_md")"
  printf 'status=ok\n'
  printf '%s\n' "$scan_output" | awk -F= '/^(security_scan)=/ { print }'
  printf 'skill_path=%s\n' "$skill_md"
  printf 'skill_rel=%s\n' "$rel_path"
  printf 'skill_name=%s\n' "$skill_name"
  printf 'skill_category=%s\n' "$category"
  printf 'skill_id=%s/%s\n' "$category" "$skill_name"
  # Backward-compat keys for finish-ticket-owner.sh:
  printf 'skill_file=%s\n' "$skill_md"
  printf 'created_from=%s\n' "$(board_rel_path "$board_root" "$ticket_file")"
}

# ---------- enumeration helpers (used by list/view/validate/archive) ----------

# Emits TSV: scope\tcategory\tname\tabs_path\tkey
# scope: in-repo | agent-created | archived
# For legacy flat skill_NNN.md (in-repo only), category="legacy", name=basename without .md.
# key for usage lookup is "<category>/<name>".
enumerate_skill_entries() {
  local project_root="$1"
  local board_dir_name="$2"
  local include_archived="${3:-true}"

  local inrepo_root agent_root archive_root
  inrepo_root="$(inrepo_skills_root_path "$project_root" "$board_dir_name")"
  agent_root="$(agent_skills_root_path "$project_root" "$board_dir_name")"
  archive_root="$(agent_archive_root_path "$project_root" "$board_dir_name")"

  if [ -d "$inrepo_root" ]; then
    # Folder-unit in-repo skills.
    find "$inrepo_root" -mindepth 3 -maxdepth 3 -type f -name 'SKILL.md' 2>/dev/null \
      | sort \
      | while IFS= read -r f; do
          local rel cat name
          rel="${f#$inrepo_root/}"
          cat="${rel%%/*}"
          name="$(basename "$(dirname "$f")")"
          # Skip if cat is reserved file (not a real skill folder)
          case "$cat" in
            ".archive"|".usage.json") continue ;;
          esac
          printf 'in-repo\t%s\t%s\t%s\t%s/%s\n' "$cat" "$name" "$f" "$cat" "$name"
        done
    # Legacy flat skill_NNN.md.
    find "$inrepo_root" -maxdepth 1 -type f -name 'skill_*.md' 2>/dev/null \
      | sort \
      | while IFS= read -r f; do
          local name
          name="$(basename "$f" .md)"
          printf 'in-repo\tlegacy\t%s\t%s\tlegacy/%s\n' "$name" "$f" "$name"
        done
  fi

  if [ -d "$agent_root" ]; then
    find "$agent_root" -mindepth 3 -maxdepth 3 -type f -name 'SKILL.md' 2>/dev/null \
      | sort \
      | while IFS= read -r f; do
          local rel cat name top
          rel="${f#$agent_root/}"
          top="${rel%%/*}"
          # Skip the .archive subtree; handled below.
          [ "$top" = ".archive" ] && continue
          cat="$top"
          name="$(basename "$(dirname "$f")")"
          printf 'agent-created\t%s\t%s\t%s\t%s/%s\n' "$cat" "$name" "$f" "$cat" "$name"
        done
  fi

  if [ "$include_archived" = "true" ] && [ -d "$archive_root" ]; then
    find "$archive_root" -mindepth 3 -maxdepth 3 -type f -name 'SKILL.md' 2>/dev/null \
      | sort \
      | while IFS= read -r f; do
          local rel cat name
          rel="${f#$archive_root/}"
          cat="${rel%%/*}"
          name="$(basename "$(dirname "$f")")"
          printf 'archived\t%s\t%s\t%s\t%s/%s\n' "$cat" "$name" "$f" "$cat" "$name"
        done
  fi
}

resolve_skill_entry() {
  # $1=project_root  $2=board_dir_name  $3=ref
  # ref: "category/name" or "name" or absolute path or "skill_NNN" (legacy)
  local project_root="$1"
  local board_dir_name="$2"
  local ref="$3"
  local entries match

  # Absolute path direct lookup.
  case "$ref" in
    /*)
      [ -f "$ref" ] || return 1
      printf 'unknown\tunknown\t%s\t%s\tunknown\n' "$(basename "$ref" .md)" "$ref"
      return 0
      ;;
  esac

  entries="$(enumerate_skill_entries "$project_root" "$board_dir_name" true)"
  if [ -z "$entries" ]; then
    return 1
  fi

  # Prefer exact "category/name" match on key.
  match="$(printf '%s\n' "$entries" | awk -F '\t' -v ref="$ref" '$5 == ref { print; exit }')"
  if [ -n "$match" ]; then
    printf '%s\n' "$match"
    return 0
  fi

  # Fall back to name match.
  match="$(printf '%s\n' "$entries" | awk -F '\t' -v ref="$ref" '$3 == ref { print; exit }')"
  if [ -n "$match" ]; then
    printf '%s\n' "$match"
    return 0
  fi

  # Legacy "skill_NNN" fallback.
  match="$(printf '%s\n' "$entries" | awk -F '\t' -v ref="$ref" '$3 == ref || $3 == ref".md" { print; exit }')"
  if [ -n "$match" ]; then
    printf '%s\n' "$match"
    return 0
  fi
  return 1
}

# ---------- subcommand: list ----------

run_list() {
  local project_root="$1"
  local board_dir_name="$2"
  local include_archived="$3"
  local entries usage_file count in_repo agent archived
  local idx=0

  usage_file="$(usage_json_path "$project_root" "$board_dir_name")"
  entries="$(enumerate_skill_entries "$project_root" "$board_dir_name" "$include_archived")"

  printf 'status=ok\n'

  count=0
  in_repo=0
  agent=0
  archived=0
  if [ -n "$entries" ]; then
    while IFS=$'\t' read -r scope category name path key; do
      idx=$((idx + 1))
      count=$((count + 1))
      case "$scope" in
        in-repo) in_repo=$((in_repo + 1)) ;;
        agent-created) agent=$((agent + 1)) ;;
        archived) archived=$((archived + 1)) ;;
      esac
      local pinned views uses last_used last_viewed
      pinned="$(extract_frontmatter_value "$path" "pinned")"
      [ -n "$pinned" ] || pinned="false"
      views="$(usage_get_field "$usage_file" "$key" "view_count")"
      uses="$(usage_get_field "$usage_file" "$key" "success_count")"
      last_used="$(usage_get_field "$usage_file" "$key" "last_used_at")"
      last_viewed="$(usage_get_field "$usage_file" "$key" "last_viewed_at")"
      printf 'skill.%d.scope=%s\n' "$idx" "$scope"
      printf 'skill.%d.category=%s\n' "$idx" "$category"
      printf 'skill.%d.name=%s\n' "$idx" "$name"
      printf 'skill.%d.key=%s\n' "$idx" "$key"
      printf 'skill.%d.path=%s\n' "$idx" "$path"
      printf 'skill.%d.pinned=%s\n' "$idx" "$pinned"
      printf 'skill.%d.view_count=%s\n' "$idx" "${views:-0}"
      printf 'skill.%d.success_count=%s\n' "$idx" "${uses:-0}"
      printf 'skill.%d.last_used_at=%s\n' "$idx" "$last_used"
      printf 'skill.%d.last_viewed_at=%s\n' "$idx" "$last_viewed"
    done <<<"$entries"
  fi

  printf 'total=%d\n' "$count"
  printf 'in_repo_count=%d\n' "$in_repo"
  printf 'agent_created_count=%d\n' "$agent"
  printf 'archived_count=%d\n' "$archived"
}

# ---------- subcommand: view ----------

run_view() {
  local project_root="$1"
  local board_dir_name="$2"
  local ref="$3"
  local entry path scope category name key usage_file

  entry="$(resolve_skill_entry "$project_root" "$board_dir_name" "$ref" || true)"
  [ -n "$entry" ] || { echo "Skill not found: $ref" >&2; exit 1; }
  IFS=$'\t' read -r scope category name path key <<<"$entry"

  usage_file="$(usage_json_path "$project_root" "$board_dir_name")"
  usage_record_event "$usage_file" "$key" "view" || true

  printf 'status=ok\n'
  printf 'scope=%s\n' "$scope"
  printf 'category=%s\n' "$category"
  printf 'name=%s\n' "$name"
  printf 'key=%s\n' "$key"
  printf 'path=%s\n' "$path"
  printf 'view_count=%s\n' "$(usage_get_field "$usage_file" "$key" "view_count")"
  printf 'last_viewed_at=%s\n' "$(usage_get_field "$usage_file" "$key" "last_viewed_at")"
  printf -- '---BODY---\n'
  cat "$path"
}

# ---------- subcommand: validate ----------

run_validate() {
  local project_root="$1"
  local board_dir_name="$2"
  local ref="$3"
  local entry path scope category name key
  local errors=0
  local warnings=0
  local issues=""

  entry="$(resolve_skill_entry "$project_root" "$board_dir_name" "$ref" || true)"
  [ -n "$entry" ] || { echo "Skill not found: $ref" >&2; exit 1; }
  IFS=$'\t' read -r scope category name path key <<<"$entry"

  local size_total size_body fm_name fm_desc body
  size_total="$(autoflow_file_size_bytes "$path")"

  if [ "$size_total" -gt $FILE_MAX ]; then
    errors=$((errors + 1))
    issues="${issues}file_size_exceeds:${size_total}>${FILE_MAX};"
  fi

  # Frontmatter must exist (start with --- on line 1).
  if [ "$(head -1 "$path")" != "---" ]; then
    if [ "$category" = "legacy" ]; then
      warnings=$((warnings + 1))
      issues="${issues}legacy_no_frontmatter;"
    else
      errors=$((errors + 1))
      issues="${issues}missing_frontmatter;"
    fi
  fi

  # Body (everything after the closing --- of frontmatter).
  body="$(awk 'BEGIN{seen=0} /^---$/{seen++; next} seen>=2{print}' "$path")"
  size_body="$(printf '%s' "$body" | wc -c | tr -d '[:space:]')"
  if [ -z "${body//[[:space:]]/}" ]; then
    errors=$((errors + 1))
    issues="${issues}empty_body;"
  fi
  if [ "$size_body" -gt $CONTENT_MAX ]; then
    errors=$((errors + 1))
    issues="${issues}content_size_exceeds:${size_body}>${CONTENT_MAX};"
  fi

  fm_name="$(extract_frontmatter_value "$path" "name" | sed -E 's/^"|"$//g')"
  fm_desc="$(extract_frontmatter_value "$path" "description" | sed -E 's/^"|"$//g')"

  if [ "$category" != "legacy" ]; then
    if [ -z "$fm_name" ]; then
      errors=$((errors + 1))
      issues="${issues}missing_name;"
    elif [ ${#fm_name} -gt $NAME_MAX ]; then
      errors=$((errors + 1))
      issues="${issues}name_too_long:${#fm_name}>${NAME_MAX};"
    fi
    if [ ${#fm_desc} -gt $DESCRIPTION_MAX ]; then
      errors=$((errors + 1))
      issues="${issues}description_too_long:${#fm_desc}>${DESCRIPTION_MAX};"
    fi
  fi

  if [ "$errors" -gt 0 ]; then
    printf 'status=fail\n'
  else
    printf 'status=ok\n'
  fi
  printf 'path=%s\n' "$path"
  printf 'scope=%s\n' "$scope"
  printf 'category=%s\n' "$category"
  printf 'name=%s\n' "$name"
  printf 'file_size=%s\n' "$size_total"
  printf 'body_size=%s\n' "$size_body"
  printf 'frontmatter_name_length=%s\n' "${#fm_name}"
  printf 'frontmatter_description_length=%s\n' "${#fm_desc}"
  printf 'errors=%s\n' "$errors"
  printf 'warnings=%s\n' "$warnings"
  printf 'issues=%s\n' "$issues"

  if [ "$errors" -gt 0 ]; then
    exit 2
  fi
}

# ---------- subcommand: archive ----------

run_archive() {
  local project_root="$1"
  local board_dir_name="$2"
  local ref="$3"
  local entry scope category name path key
  local agent_root archive_root pinned target_dir

  entry="$(resolve_skill_entry "$project_root" "$board_dir_name" "$ref" || true)"
  [ -n "$entry" ] || { echo "Skill not found: $ref" >&2; exit 1; }
  IFS=$'\t' read -r scope category name path key <<<"$entry"

  if [ "$scope" != "agent-created" ]; then
    printf 'status=fail\n'
    printf 'reason=archive_only_for_agent_created\n'
    printf 'scope=%s\n' "$scope"
    exit 3
  fi

  pinned="$(extract_frontmatter_value "$path" "pinned")"
  if [ "$pinned" = "true" ]; then
    printf 'status=fail\n'
    printf 'reason=pinned_skill_bypasses_lifecycle\n'
    printf 'name=%s\n' "$name"
    printf 'category=%s\n' "$category"
    exit 4
  fi

  agent_root="$(agent_skills_root_path "$project_root" "$board_dir_name")"
  archive_root="$(agent_archive_root_path "$project_root" "$board_dir_name")"
  target_dir="${archive_root}/${category}/${name}"

  ensure_dir "${archive_root}/${category}"
  if [ -e "$target_dir" ]; then
    target_dir="${target_dir}-$(date -u +%Y%m%dT%H%M%SZ)"
  fi
  mv "$(dirname "$path")" "$target_dir"

  printf 'status=ok\n'
  printf 'name=%s\n' "$name"
  printf 'category=%s\n' "$category"
  printf 'archived_path=%s\n' "${target_dir}/SKILL.md"
}

# ---------- legacy match (flat + folder skills) ----------

flat_match_score() {
  local query_file="$1"
  local candidate_file="$2"
  local keywords title body applies score

  keywords="$(awk '
    /^keywords:/ { in_keywords=1; next }
    in_keywords && /^  - / { line=$0; sub(/^  - "/, "", line); sub(/"$/, "", line); print line; next }
    in_keywords && /^    - / { line=$0; sub(/^    - "/, "", line); sub(/"$/, "", line); print line; next }
    in_keywords && /^[^ ]/ { in_keywords=0 }
  ' "$candidate_file")"
  title="$(extract_frontmatter_value "$candidate_file" "title" | sed -E 's/^"|"$//g')"
  if [ -z "$title" ]; then
    title="$(extract_frontmatter_value "$candidate_file" "name" | sed -E 's/^"|"$//g')"
  fi
  applies="$(awk '
    /^applies_to:/ { in_section=1; next }
    in_section && /^  - / { line=$0; sub(/^  - "/, "", line); sub(/"$/, "", line); print line; next }
    in_section && /^  module:/ { line=$0; sub(/^  module:[[:space:]]*"?/, "", line); sub(/"$/, "", line); print line; next }
    in_section && /^[^ ]/ { in_section=0 }
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

run_match() {
  local project_root="$1"
  local board_dir_name="$2"
  local keywords_input="$3"
  local limit="$4"
  local entries query_file match_file count score

  entries="$(enumerate_skill_entries "$project_root" "$board_dir_name" false)"
  query_file="$(autoflow_mktemp)"
  match_file="$(autoflow_mktemp)"
  printf '%s\n' "$keywords_input" | normalize_words | unique_lines > "$query_file"

  : > "$match_file"
  if [ -n "$entries" ]; then
    while IFS=$'\t' read -r scope category name path key; do
      score="$(flat_match_score "$query_file" "$path")"
      [ "$score" -gt 0 ] || continue
      printf '%s\t%s\t%s\n' "$score" "$key" "$path" >> "$match_file"
    done <<<"$entries"
  fi

  printf 'status=ok\n'
  if [ ! -s "$match_file" ]; then
    printf 'match_count=0\n'
    return 0
  fi

  count=0
  sort -t "$(printf '\t')" -k1,1nr -k2,2 "$match_file" | while IFS="$(printf '\t')" read -r score skill_id path; do
    count=$((count + 1))
    if [ "$count" -gt "$limit" ]; then
      break
    fi
    printf 'match.%s.score=%s\n' "$count" "$score"
    printf 'match.%s.skill_id=%s\n' "$count" "$skill_id"
    printf 'match.%s.path=%s\n' "$count" "$path"
  done
  printf 'match_count=%s\n' "$(sort -t "$(printf '\t')" -k1,1nr -k2,2 "$match_file" | head -n "$limit" | wc -l | tr -d '[:space:]')"
}

# ---------- legacy update-stats (flat + sidecar for folder skills) ----------

run_update_stats() {
  local project_root="$1"
  local board_dir_name="$2"
  local skill_ref="$3"
  local result="$4"
  local entry scope category name path key usage_file

  # Try folder/legacy resolution first; fall back to legacy flat in skills/.
  entry="$(resolve_skill_entry "$project_root" "$board_dir_name" "$skill_ref" || true)"
  if [ -z "$entry" ]; then
    local inrepo_root candidate
    inrepo_root="$(inrepo_skills_root_path "$project_root" "$board_dir_name")"
    case "$skill_ref" in
      /*) candidate="$skill_ref" ;;
      *.md) candidate="${inrepo_root}/$(basename "$skill_ref")" ;;
      *) candidate="${inrepo_root}/$(basename "$skill_ref").md" ;;
    esac
    [ -f "$candidate" ] || { echo "Skill not found: $skill_ref" >&2; exit 1; }
    entry="$(printf 'in-repo\tlegacy\t%s\t%s\tlegacy/%s\n' "$(basename "$candidate" .md)" "$candidate" "$(basename "$candidate" .md)")"
  fi
  IFS=$'\t' read -r scope category name path key <<<"$entry"

  # For legacy flat files, keep updating frontmatter counters in-place.
  if [ "$category" = "legacy" ]; then
    local now tmp_file
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
    ' "$path" > "$tmp_file"
    mv "$tmp_file" "$path"
  fi

  # Always also write to sidecar so unified stats are available.
  usage_file="$(usage_json_path "$project_root" "$board_dir_name")"
  usage_record_event "$usage_file" "$key" "$result" || true

  printf 'status=ok\n'
  printf 'skill_path=%s\n' "$path"
  printf 'skill_id=%s\n' "$key"
  printf 'success_count=%s\n' "$(usage_get_field "$usage_file" "$key" success_count)"
  printf 'failure_count=%s\n' "$(usage_get_field "$usage_file" "$key" failure_count)"
  printf 'last_used_at=%s\n' "$(usage_get_field "$usage_file" "$key" last_used_at)"
}

# ---------- curator + auto-extraction (prd_166) ----------

curator_state_path() {
  local project_root="$1"
  local board_dir_name="$2"
  printf '%s/runners/state/wiki.curator.state' "$(board_root_path "$project_root" "$board_dir_name")"
}

curator_state_field() {
  local state_file="$1"
  local field="$2"
  [ -f "$state_file" ] || return 0
  awk -F= -v field="$field" '$1 == field { sub(/^[^=]*=/, "", $0); print; found=1; exit } END { exit(found ? 0 : 1) }' "$state_file" 2>/dev/null || true
}

curator_write_state() {
  local state_file="$1"
  shift
  local tmp
  tmp="$(autoflow_mktemp)"
  mkdir -p "$(dirname "$state_file")"
  printf '%s\n' "$@" > "$tmp"
  mv "$tmp" "$state_file"
}

iso_to_epoch() {
  local value="$1"
  [ -n "$value" ] || return 1
  date -u -d "$value" +%s 2>/dev/null || date -j -u -f '%Y-%m-%dT%H:%M:%SZ' "$value" +%s 2>/dev/null
}

days_since_iso() {
  local now_epoch="$1"
  local value="$2"
  local then_epoch
  then_epoch="$(iso_to_epoch "$value" || true)"
  case "$then_epoch" in
    ''|*[!0-9]*) printf '0' ;;
    *) printf '%s' $(((now_epoch - then_epoch) / 86400)) ;;
  esac
}

skill_last_activity_at() {
  local usage_file="$1"
  local key="$2"
  local path="$3"
  local value
  value="$(usage_get_field "$usage_file" "$key" "last_used_at")"
  [ -n "$value" ] || value="$(usage_get_field "$usage_file" "$key" "last_viewed_at")"
  [ -n "$value" ] || value="$(extract_frontmatter_value "$path" "created_at" | sed -E 's/^"|"$//g')"
  printf '%s' "$value"
}

set_frontmatter_scalar() {
  local file="$1"
  local key="$2"
  local value="$3"
  local tmp
  tmp="$(autoflow_mktemp)"
  awk -v key="$key" -v value="$value" '
    NR == 1 && $0 == "---" { in_fm=1; print; next }
    in_fm && $0 == "---" {
      if (!updated) print key ": " value
      in_fm=0
      print
      next
    }
    in_fm && index($0, key ":") == 1 {
      print key ": " value
      updated=1
      next
    }
    { print }
  ' "$file" > "$tmp"
  mv "$tmp" "$file"
}

run_curator_status() {
  local project_root="$1"
  local board_dir_name="$2"
  local state_file usage_file entries
  local agent_count archived_count stale_count pinned_count

  state_file="$(curator_state_path "$project_root" "$board_dir_name")"
  usage_file="$(usage_json_path "$project_root" "$board_dir_name")"
  entries="$(enumerate_skill_entries "$project_root" "$board_dir_name" true)"
  agent_count=0
  archived_count=0
  stale_count=0
  pinned_count=0
  if [ -n "$entries" ]; then
    while IFS=$'\t' read -r scope category name path key; do
      case "$scope" in
        agent-created) agent_count=$((agent_count + 1)) ;;
        archived) archived_count=$((archived_count + 1)) ;;
      esac
      [ "$(extract_frontmatter_value "$path" "state")" = "stale" ] && stale_count=$((stale_count + 1))
      [ "$(extract_frontmatter_value "$path" "pinned")" = "true" ] && pinned_count=$((pinned_count + 1))
    done <<<"$entries"
  fi

  printf 'status=ok\n'
  printf 'state_file=%s\n' "$state_file"
  printf 'last_run_at=%s\n' "$(curator_state_field "$state_file" last_run_at)"
  printf 'run_count=%s\n' "$(curator_state_field "$state_file" run_count)"
  printf 'paused=%s\n' "$(curator_state_field "$state_file" paused)"
  printf 'last_summary=%s\n' "$(curator_state_field "$state_file" last_summary)"
  printf 'agent_created_count=%s\n' "$agent_count"
  printf 'archived_count=%s\n' "$archived_count"
  printf 'stale_count=%s\n' "$stale_count"
  printf 'pinned_count=%s\n' "$pinned_count"
  printf 'usage_file=%s\n' "$usage_file"
}

run_curator_run() {
  local project_root="$1"
  local board_dir_name="$2"
  local once="$3"
  local idle="$4"
  local now_iso_value="$5"
  local state_file last_run_at last_run_epoch now_epoch interval_hours stale_days archive_days
  local entries usage_file run_count paused summary cluster_output cluster_count
  local reviewed=0 stale_marked=0 archived=0 pinned_skipped=0 active_kept=0

  state_file="$(curator_state_path "$project_root" "$board_dir_name")"
  usage_file="$(usage_json_path "$project_root" "$board_dir_name")"
  now_iso_value="${now_iso_value:-$(date -u '+%Y-%m-%dT%H:%M:%SZ')}"

  case "${AUTOFLOW_CURATOR_ENABLED:-1}" in
    0|false|off|no|FALSE|OFF|NO)
      printf 'status=skipped\n'
      printf 'reason=disabled_by_env\n'
      printf 'state_file=%s\n' "$state_file"
      return 0
      ;;
  esac

  interval_hours="${AUTOFLOW_CURATOR_INTERVAL_HOURS:-168}"
  stale_days="${AUTOFLOW_CURATOR_STALE_AFTER_DAYS:-30}"
  archive_days="${AUTOFLOW_CURATOR_ARCHIVE_AFTER_DAYS:-90}"
  now_epoch="$(iso_to_epoch "$now_iso_value")"
  last_run_at="$(curator_state_field "$state_file" last_run_at)"
  last_run_epoch="$(iso_to_epoch "$last_run_at" 2>/dev/null || true)"

  if [ "$once" != "true" ] && [ -n "$last_run_epoch" ]; then
    if [ $((now_epoch - last_run_epoch)) -lt $((interval_hours * 3600)) ]; then
      printf 'status=skipped\n'
      printf 'reason=interval_not_elapsed\n'
      printf 'last_run_at=%s\n' "$last_run_at"
      printf 'interval_hours=%s\n' "$interval_hours"
      return 0
    fi
  fi

  entries="$(enumerate_skill_entries "$project_root" "$board_dir_name" false)"
  if [ -n "$entries" ]; then
    while IFS=$'\t' read -r scope category name path key; do
      [ "$scope" = "agent-created" ] || continue
      reviewed=$((reviewed + 1))
      if [ "$(extract_frontmatter_value "$path" "pinned")" = "true" ]; then
        pinned_skipped=$((pinned_skipped + 1))
        continue
      fi

      local last_activity age_days ref archive_output
      last_activity="$(skill_last_activity_at "$usage_file" "$key" "$path")"
      age_days="$(days_since_iso "$now_epoch" "$last_activity")"
      case "$age_days" in ''|*[!0-9]* ) age_days=0 ;; esac

      if [ "$age_days" -ge "$archive_days" ]; then
        ref="${category}/${name}"
        archive_output="$(run_archive "$project_root" "$board_dir_name" "$ref" 2>&1)" || true
        printf '%s\n' "$archive_output" | grep -q '^status=ok$' && archived=$((archived + 1))
      elif [ "$age_days" -ge "$stale_days" ]; then
        set_frontmatter_scalar "$path" "state" "stale"
        stale_marked=$((stale_marked + 1))
      else
        active_kept=$((active_kept + 1))
      fi
    done <<<"$entries"
  fi

  run_count="$(curator_state_field "$state_file" run_count)"
  case "$run_count" in ''|*[!0-9]*) run_count=0 ;; esac
  run_count=$((run_count + 1))
  paused="$(curator_state_field "$state_file" paused)"
  [ -n "$paused" ] || paused="false"
  cluster_output="$(run_cluster_detect "$project_root" "$board_dir_name" "${AUTOFLOW_SKILL_CLUSTER_THRESHOLD_PERCENT:-70}" 2>/dev/null || true)"
  cluster_count="$(printf '%s\n' "$cluster_output" | awk -F= '$1 == "cluster_count" { print $2; found=1; exit } END { exit(found ? 0 : 1) }' 2>/dev/null || true)"
  case "$cluster_count" in ''|*[!0-9]*) cluster_count=0 ;; esac

  summary="reviewed=${reviewed},stale=${stale_marked},archived=${archived},pinned_skipped=${pinned_skipped},active=${active_kept},clusters=${cluster_count},idle=${idle}"
  curator_write_state "$state_file" \
    "last_run_at=${now_iso_value}" \
    "run_count=${run_count}" \
    "paused=${paused}" \
    "last_summary=${summary}" \
    "auxiliary_client=true" \
    "main_prompt_cache_touched=false"

  printf 'status=ok\n'
  printf 'state_file=%s\n' "$state_file"
  printf 'last_run_at=%s\n' "$now_iso_value"
  printf 'run_count=%s\n' "$run_count"
  printf 'reviewed_count=%s\n' "$reviewed"
  printf 'stale_marked_count=%s\n' "$stale_marked"
  printf 'archived_count=%s\n' "$archived"
  printf 'pinned_skipped_count=%s\n' "$pinned_skipped"
  printf 'active_kept_count=%s\n' "$active_kept"
  printf 'cluster_candidate_count=%s\n' "$cluster_count"
  printf 'auxiliary_client=true\n'
  printf 'main_prompt_cache_touched=false\n'
  printf '%s\n' "$cluster_output" | awk -F= '/^cluster\.[0-9]+\./ { print "cluster_candidate." $0 }'
}

run_auto_extract() {
  local project_root="$1"
  local board_dir_name="$2"
  local ticket_ref="$3"
  local pattern_type="$4"
  local override_name="$5"
  local override_category="$6"
  local category

  [ -n "$ticket_ref" ] || { echo "--from-ticket is required" >&2; exit 1; }
  [ -n "$pattern_type" ] || { echo "--pattern-type is required" >&2; exit 1; }
  category="${override_category:-$pattern_type}"
  category="$(printf '%s' "$category" | tr '_' '-')"
  run_create "$project_root" "$board_dir_name" "$ticket_ref" "$override_name" "$category" "$pattern_type"
}

run_scan() {
  local project_root="$1"
  local board_dir_name="$2"
  local scan_file="$3"
  local source_ref="$4"

  skill_security_scan_file "$project_root" "$board_dir_name" "$scan_file" "$source_ref"
}

run_agentskills_import() {
  local project_root="$1"
  local board_dir_name="$2"
  local source_ref="$3"
  local override_name="$4"
  local override_category="$5"
  local board_root target_root category output_path scan_output

  board_root="$(board_root_path "$project_root" "$board_dir_name")"
  category="$(slugify_name "${override_category:-imported}")"
  target_root="$(inrepo_skills_root_path "$project_root" "$board_dir_name")/${category}"
  ensure_dir "$target_root"

  command -v python3 >/dev/null 2>&1 || { echo "python3 is required for skill import" >&2; exit 1; }
  output_path="$(python3 - "$source_ref" "$target_root" "$override_name" <<'PY'
import datetime as dt
import os
import re
import sys
import urllib.request

source, target_root, override_name = sys.argv[1:4]

def slugify(value):
    value = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return (value or "imported-skill")[:64].strip("-") or "imported-skill"

if re.match(r"^https?://", source):
    with urllib.request.urlopen(source, timeout=30) as resp:
        text = resp.read().decode("utf-8")
else:
    path = source[7:] if source.startswith("file://") else source
    with open(path, "r", encoding="utf-8") as fh:
        text = fh.read()

frontmatter = {}
body = text
if text.startswith("---\n"):
    end = text.find("\n---", 4)
    if end != -1:
        fm_text = text[4:end].strip("\n")
        body = text[end + 4 :].lstrip("\n")
        stack = []
        for raw in fm_text.splitlines():
            if not raw.strip() or raw.lstrip().startswith("#"):
                continue
            indent = len(raw) - len(raw.lstrip(" "))
            line = raw.strip()
            if ":" not in line:
                continue
            key, value = line.split(":", 1)
            value = value.strip().strip('"')
            while stack and stack[-1][0] >= indent:
                stack.pop()
            dotted = ".".join([item[1] for item in stack] + [key])
            if value:
                frontmatter[dotted] = value
            else:
                stack.append((indent, key))

name = override_name or frontmatter.get("name") or frontmatter.get("title") or "imported-skill"
slug = slugify(name)
description = (frontmatter.get("description") or "").replace('"', '\\"')[:1024]
pattern_type = frontmatter.get("metadata.autoflow.pattern_type") or frontmatter.get("pattern_type") or "imported"
module = frontmatter.get("metadata.autoflow.applies_to.module") or frontmatter.get("applies_to.module") or "general"
ticket = frontmatter.get("metadata.autoflow.created_from.ticket") or frontmatter.get("created_from.ticket") or ""
prd = frontmatter.get("metadata.autoflow.created_from.prd") or frontmatter.get("created_from.prd") or ""

target_dir = os.path.join(target_root, slug)
base = target_dir
i = 2
while os.path.exists(target_dir):
    target_dir = f"{base}-{i}"
    i += 1
os.makedirs(target_dir, exist_ok=True)
path = os.path.join(target_dir, "SKILL.md")
now = dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
with open(path, "w", encoding="utf-8") as fh:
    fh.write("---\n")
    fh.write(f'name: "{slug}"\n')
    fh.write(f'description: "{description}"\n')
    fh.write(f"pattern_type: {pattern_type}\n")
    fh.write("applies_to:\n")
    fh.write(f'  module: "{module}"\n')
    fh.write("  keywords:\n")
    for token in sorted(set(re.findall(r"[A-Za-z0-9][A-Za-z0-9_-]{2,}", f"{name} {description} {module}"))):
        fh.write(f'    - "{token.lower()}"\n')
    fh.write("pinned: false\n")
    fh.write("created_from:\n")
    fh.write(f'  prd: "{prd}"\n' if prd else "  prd: null\n")
    fh.write(f'  ticket: "{ticket}"\n' if ticket else "  ticket: null\n")
    fh.write(f'created_at: "{now}"\n')
    fh.write("source_format: agentskills.io\n")
    fh.write("---\n\n")
    fh.write(body.rstrip() + "\n")
print(path)
PY
)"

  if ! scan_output="$(skill_security_scan_file "$project_root" "$board_dir_name" "$output_path" "import:${source_ref}" 2>&1)"; then
    rm -rf "$(dirname "$output_path")"
    printf '%s\n' "$scan_output"
    exit 6
  fi

  printf 'status=ok\n'
  printf 'format=agentskills.io\n'
  printf 'skill_path=%s\n' "$output_path"
  printf 'skill_rel=%s\n' "$(board_rel_path "$board_root" "$output_path")"
  printf '%s\n' "$scan_output" | awk -F= '/^(security_scan)=/ { print }'
}

run_agentskills_export() {
  local project_root="$1"
  local board_dir_name="$2"
  local ref="$3"
  local entry scope category name path key

  entry="$(resolve_skill_entry "$project_root" "$board_dir_name" "$ref" || true)"
  [ -n "$entry" ] || { echo "Skill not found: $ref" >&2; exit 1; }
  IFS=$'\t' read -r scope category name path key <<<"$entry"

  command -v python3 >/dev/null 2>&1 || { echo "python3 is required for skill export" >&2; exit 1; }
  python3 - "$path" "$key" <<'PY'
import sys

path, key = sys.argv[1:3]
text = open(path, "r", encoding="utf-8").read()
fm = {}
body = text
if text.startswith("---\n"):
    end = text.find("\n---", 4)
    if end != -1:
        for raw in text[4:end].strip("\n").splitlines():
            if ":" not in raw:
                continue
            k, v = raw.strip().split(":", 1)
            fm[k.strip()] = v.strip().strip('"')
        body = text[end + 4 :].lstrip("\n")
print("---")
print(f'name: "{fm.get("name") or key.split("/")[-1]}"')
print(f'description: "{fm.get("description", "")}"')
print("metadata:")
print("  autoflow:")
print(f'    skill_id: "{key}"')
print(f'    pattern_type: "{fm.get("pattern_type", "")}"')
print("    applies_to:")
print(f'      module: "{fm.get("module", "")}"')
print("      keywords: []")
print("---")
print()
print(body.rstrip())
PY
}

run_cluster_detect() {
  local project_root="$1"
  local board_dir_name="$2"
  local threshold_percent="$3"
  local entries tmp

  entries="$(enumerate_skill_entries "$project_root" "$board_dir_name" false)"
  tmp="$(autoflow_mktemp)"
  printf '%s\n' "$entries" > "$tmp"
  command -v python3 >/dev/null 2>&1 || { echo "python3 is required for cluster-detect" >&2; exit 1; }
  python3 - "$tmp" "$threshold_percent" <<'PY'
import re
import sys

entries_path, threshold_s = sys.argv[1:3]
threshold = max(0, min(100, int(threshold_s or "70"))) / 100.0

def fm(path, key):
    try:
        text = open(path, encoding="utf-8").read()
    except OSError:
        return ""
    if not text.startswith("---\n"):
        return ""
    end = text.find("\n---", 4)
    if end == -1:
        return ""
    lines = text[4:end].splitlines()
    out = []
    in_keywords = False
    for raw in lines:
        if key == "keywords":
            if raw.strip() == "keywords:":
                in_keywords = True
                continue
            if in_keywords:
                if raw.startswith("    - "):
                    out.append(raw.split("-", 1)[1].strip().strip('"'))
                    continue
                if raw and not raw.startswith(" "):
                    in_keywords = False
        if raw.strip().startswith(key + ":"):
            return raw.strip().split(":", 1)[1].strip().strip('"')
    return " ".join(out) if key == "keywords" else ""

skills = []
for line in open(entries_path, encoding="utf-8"):
    if not line.strip():
        continue
    scope, category, name, path, key = line.rstrip("\n").split("\t")
    words = set(re.findall(r"[a-z0-9]{3,}", f"{name} {fm(path, 'keywords')}".lower()))
    skills.append({"key": key, "path": path, "pattern": fm(path, "pattern_type"), "module": fm(path, "module"), "words": words})

clusters = []
used = set()
for i, a in enumerate(skills):
    if a["key"] in used or not a["words"]:
        continue
    group = [a]
    for b in skills[i + 1:]:
        if a["pattern"] != b["pattern"] or a["module"] != b["module"] or not b["words"]:
            continue
        overlap = len(a["words"] & b["words"]) / max(1, min(len(a["words"]), len(b["words"])))
        if overlap >= threshold:
            group.append(b)
    if len(group) >= 2:
        clusters.append(group)
        used.update(item["key"] for item in group)

print("status=ok")
print(f"threshold_percent={int(threshold * 100)}")
print(f"cluster_count={len(clusters)}")
for idx, group in enumerate(clusters, 1):
    print(f"cluster.{idx}.skill_ids={','.join(item['key'] for item in group)}")
    print(f"cluster.{idx}.size={len(group)}")
PY
}

run_meta_extract() {
  local project_root="$1"
  local board_dir_name="$2"
  local cluster_refs="$3"
  local override_name="$4"
  local override_category="$5"
  local board_root agent_root category name skill_dir skill_md entries_file ref entry paths_file scan_output

  board_root="$(board_root_path "$project_root" "$board_dir_name")"
  agent_root="$(agent_skills_root_path "$project_root" "$board_dir_name")"
  category="$(slugify_name "${override_category:-meta}")"
  name="$(slugify_name "${override_name:-meta-skill}")"
  ensure_dir "${agent_root}/${category}"
  skill_dir="$(derive_unique_skill_dir "${agent_root}/${category}" "$name")"
  skill_md="${skill_dir}/SKILL.md"
  paths_file="$(autoflow_mktemp)"

  IFS=',' read -ra refs <<<"$cluster_refs"
  for ref in "${refs[@]}"; do
    ref="$(printf '%s' "$ref" | sed -E 's/^[[:space:]]+|[[:space:]]+$//g')"
    [ -n "$ref" ] || continue
    entry="$(resolve_skill_entry "$project_root" "$board_dir_name" "$ref" || true)"
    [ -n "$entry" ] || { echo "Skill not found: $ref" >&2; exit 1; }
    printf '%s\n' "$entry" | awk -F '\t' '{ print $4 }' >> "$paths_file"
  done
  [ "$(wc -l < "$paths_file" | tr -d '[:space:]')" -ge 2 ] || { echo "meta-extract requires at least two skills" >&2; exit 1; }

  command -v python3 >/dev/null 2>&1 || { echo "python3 is required for meta-extract" >&2; exit 1; }
  python3 - "$paths_file" "$skill_md" "$(basename "$skill_dir")" <<'PY'
import datetime as dt
import os
import re
import sys

paths_file, out_path, name = sys.argv[1:4]
paths = [line.strip() for line in open(paths_file, encoding="utf-8") if line.strip()]

def text(path):
    return open(path, encoding="utf-8").read()

def val(content, key):
    if not content.startswith("---\n"):
        return ""
    end = content.find("\n---", 4)
    fm = content[4:end] if end != -1 else ""
    for raw in fm.splitlines():
        if raw.strip().startswith(key + ":"):
            return raw.strip().split(":", 1)[1].strip().strip('"')
    return ""

contents = [text(p) for p in paths]
word_sets = [set(re.findall(r"[a-z0-9]{3,}", c.lower())) for c in contents]
common = sorted(set.intersection(*word_sets))[:12] if word_sets else []
pattern = val(contents[0], "pattern_type") or "meta"
module = val(contents[0], "module") or "general"
now = dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
os.makedirs(os.path.dirname(out_path), exist_ok=True)
with open(out_path, "w", encoding="utf-8") as fh:
    fh.write("---\n")
    fh.write(f'name: "{name}"\n')
    fh.write(f'description: "Meta-skill extracted from {len(paths)} related Autoflow skills."\n')
    fh.write(f"pattern_type: meta_{pattern}\n")
    fh.write("applies_to:\n")
    fh.write(f'  module: "{module}"\n')
    fh.write("  keywords:\n")
    for word in common or ["autoflow", "skill", "meta"]:
        fh.write(f'    - "{word}"\n')
    fh.write("pinned: false\n")
    fh.write("state: review\n")
    fh.write("created_from:\n")
    fh.write("  prd: null\n")
    fh.write("  ticket: null\n")
    fh.write(f'created_at: "{now}"\n')
    fh.write("---\n\n")
    fh.write(f"# {name}\n\n")
    fh.write("## Trigger\n\n")
    fh.write("- Reuse when several related skills share the same module, pattern type, and keyword overlap.\n\n")
    fh.write("## Recommended Procedure\n\n")
    for word in common[:5] or ["shared workflow"]:
        fh.write(f"- Apply the shared `{word}` pattern from the source cluster.\n")
    fh.write("\n## Source Cluster\n\n")
    for path in paths:
        fh.write(f"- `{path}`\n")
PY

  if ! scan_output="$(skill_security_scan_file "$project_root" "$board_dir_name" "$skill_md" "meta-extract:${cluster_refs}" 2>&1)"; then
    rm -rf "$skill_dir"
    printf '%s\n' "$scan_output"
    exit 6
  fi
  printf 'status=ok\n'
  printf 'skill_path=%s\n' "$skill_md"
  printf 'skill_rel=%s\n' "$(board_rel_path "$board_root" "$skill_md")"
  printf 'review_required=true\n'
  printf '%s\n' "$scan_output" | awk -F= '/^(security_scan)=/ { print }'
}

run_apply() {
  local project_root="$1"
  local board_dir_name="$2"
  local keywords_input="$3"
  local deterministic_requested="$4"
  local entries tmp usage_file min_rate min_count

  if [ "$deterministic_requested" != "true" ]; then
    case "${AUTOFLOW_SKILL_DETERMINISTIC_MODE_ENABLED:-0}" in
      1|true|on|yes|TRUE|ON|YES) deterministic_requested="true" ;;
    esac
  fi
  if [ "$deterministic_requested" != "true" ]; then
    printf 'status=skipped\n'
    printf 'reason=deterministic_mode_disabled\n'
    printf 'llm_fallback=true\n'
    return 0
  fi

  entries="$(enumerate_skill_entries "$project_root" "$board_dir_name" false)"
  tmp="$(autoflow_mktemp)"
  printf '%s\n' "$entries" > "$tmp"
  usage_file="$(usage_json_path "$project_root" "$board_dir_name")"
  min_rate="${AUTOFLOW_SKILL_DETERMINISTIC_MIN_SUCCESS_RATE_PERCENT:-95}"
  min_count="${AUTOFLOW_SKILL_DETERMINISTIC_MIN_SUCCESS_COUNT:-10}"
  command -v python3 >/dev/null 2>&1 || { echo "python3 is required for skill apply" >&2; exit 1; }
  python3 - "$tmp" "$usage_file" "$keywords_input" "$min_rate" "$min_count" "${AUTOFLOW_SKILL_DETERMINISTIC_FORCE_FAIL:-0}" <<'PY'
import json
import os
import re
import sys

entries_path, usage_path, query, min_rate_s, min_count_s, force_fail = sys.argv[1:7]
min_rate = float(min_rate_s or 95)
min_count = int(min_count_s or 10)
usage = {}
if os.path.exists(usage_path):
    try:
        usage = json.load(open(usage_path, encoding="utf-8"))
    except Exception:
        usage = {}
q = set(re.findall(r"[a-z0-9]{3,}", query.lower()))
best = None
for line in open(entries_path, encoding="utf-8"):
    if not line.strip():
        continue
    scope, category, name, path, key = line.rstrip("\n").split("\t")
    content = open(path, encoding="utf-8").read()
    if re.search(r"^deterministic_disabled:\s*true", content, re.M):
        continue
    words = set(re.findall(r"[a-z0-9]{3,}", content.lower()))
    score = len(q & words)
    stats = usage.get(key, {}) if isinstance(usage, dict) else {}
    success = int(stats.get("success_count", 0) or 0)
    failure = int(stats.get("failure_count", 0) or 0)
    rate = 100.0 * success / max(1, success + failure)
    if score > 0 and success >= min_count and rate >= min_rate:
        item = (score, key, path, success, failure, rate, content)
        if best is None or item > best:
            best = item
if best is None:
    print("status=skipped")
    print("reason=no_skill_meets_deterministic_threshold")
    print("llm_fallback=true")
    sys.exit(0)
score, key, path, success, failure, rate, content = best
if force_fail in ("1", "true", "on", "yes"):
    content = re.sub(r"(?m)^---\n", "---\ndeterministic_disabled: true\n", content, count=1) if content.startswith("---\n") else "deterministic_disabled: true\n" + content
    open(path, "w", encoding="utf-8").write(content)
    stats = usage.setdefault(key, {})
    stats["failure_count"] = int(stats.get("failure_count", 0) or 0) + 1
    os.makedirs(os.path.dirname(usage_path), exist_ok=True)
    json.dump(usage, open(usage_path, "w", encoding="utf-8"), indent=2, sort_keys=True)
    print("status=fail")
    print("reason=deterministic_execution_failed")
    print(f"skill_id={key}")
    print("deterministic_disabled=true")
    print("llm_fallback=true")
    sys.exit(7)
print("status=ok")
print("mode=deterministic")
print("llm_called=false")
print(f"skill_id={key}")
print(f"success_rate_percent={rate:.2f}")
print(f"success_count={success}")
print("---PROCEDURE---")
capture = False
for raw in content.splitlines():
    if raw.strip() == "## Recommended Procedure":
        capture = True
        continue
    if capture and raw.startswith("## "):
        break
    if capture and raw.strip():
        print(raw)
PY
}

run_metrics() {
  local project_root="$1"
  local board_dir_name="$2"
  local window_days="$3"
  local board_root entries_file usage_file cluster_output

  board_root="$(board_root_path "$project_root" "$board_dir_name")"
  entries_file="$(autoflow_mktemp)"
  enumerate_skill_entries "$project_root" "$board_dir_name" false > "$entries_file"
  usage_file="$(usage_json_path "$project_root" "$board_dir_name")"
  cluster_output="$(run_cluster_detect "$project_root" "$board_dir_name" "${AUTOFLOW_SKILL_CLUSTER_THRESHOLD_PERCENT:-70}" 2>/dev/null || true)"

  command -v python3 >/dev/null 2>&1 || { echo "python3 is required for skill metrics" >&2; exit 1; }
  python3 - "$board_root" "$entries_file" "$usage_file" "$window_days" "${AUTOFLOW_SKILL_DETERMINISTIC_MIN_SUCCESS_RATE_PERCENT:-95}" "${AUTOFLOW_SKILL_DETERMINISTIC_MIN_SUCCESS_COUNT:-10}" "$cluster_output" <<'PY'
import datetime as dt
import json
import os
import re
import sys

board_root, entries_path, usage_path, window_days_s, min_rate_s, min_count_s, cluster_output = sys.argv[1:8]
window_days = int(window_days_s or 7)
min_rate = float(min_rate_s or 95)
min_count = int(min_count_s or 10)
now = dt.datetime.utcnow().replace(tzinfo=dt.timezone.utc)
start = now - dt.timedelta(days=window_days)

def parse_iso(value):
    value = (value or "").strip().strip('"')
    if not value:
        return None
    try:
        return dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return None

security_blocks = 0
check_dir = os.path.join(board_root, "tickets", "check")
if os.path.isdir(check_dir):
    for name in os.listdir(check_dir):
        if not re.match(r"check_[0-9]+\.md$", name):
            continue
        path = os.path.join(check_dir, name)
        text = open(path, encoding="utf-8").read()
        if "event_type: \"skill_security_scan_blocked\"" not in text and "event_type: skill_security_scan_blocked" not in text:
            continue
        m = re.search(r"created_at:\s*\"?([^\"\n]+)", text)
        created = parse_iso(m.group(1) if m else "")
        if created is None or created >= start:
            security_blocks += 1

usage = {}
if os.path.exists(usage_path):
    try:
        usage = json.load(open(usage_path, encoding="utf-8"))
    except Exception:
        usage = {}

total_skills = 0
eligible = 0
for line in open(entries_path, encoding="utf-8"):
    if not line.strip():
        continue
    total_skills += 1
    *_, key = line.rstrip("\n").split("\t")
    stats = usage.get(key, {}) if isinstance(usage, dict) else {}
    success = int(stats.get("success_count", 0) or 0)
    failure = int(stats.get("failure_count", 0) or 0)
    rate = 100.0 * success / max(1, success + failure)
    if success >= min_count and rate >= min_rate:
        eligible += 1

cluster_count = 0
for raw in cluster_output.splitlines():
    if raw.startswith("cluster_count="):
        try:
            cluster_count = int(raw.split("=", 1)[1])
        except ValueError:
            cluster_count = 0

ratio = 100.0 * eligible / max(1, total_skills)
print("status=ok")
print(f"window_days={window_days}")
print(f"security_scan_blocked_count={security_blocks}")
print(f"cluster_candidate_count={cluster_count}")
print(f"deterministic_eligible_count={eligible}")
print(f"skill_count={total_skills}")
print(f"deterministic_execution_ratio_percent={ratio:.2f}")
PY
}

# ---------- dispatch ----------

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
    override_name=""
    override_category=""
    override_pattern_type=""
    while [ $# -gt 0 ]; do
      case "$1" in
        --from-ticket) ticket_ref="${2:-}"; shift 2 ;;
        --name) override_name="${2:-}"; shift 2 ;;
        --category) override_category="${2:-}"; shift 2 ;;
        --pattern-type) override_pattern_type="${2:-}"; shift 2 ;;
        *) echo "Unknown argument: $1" >&2; usage; exit 1 ;;
      esac
    done
    [ -n "$ticket_ref" ] || { usage; exit 1; }
    run_create "$project_root" "$board_dir_name" "$ticket_ref" "$override_name" "$override_category" "$override_pattern_type"
    ;;
  list)
    include_archived="true"
    while [ $# -gt 0 ]; do
      case "$1" in
        --include-archived) include_archived="true"; shift ;;
        --no-archived) include_archived="false"; shift ;;
        *) echo "Unknown argument: $1" >&2; usage; exit 1 ;;
      esac
    done
    run_list "$project_root" "$board_dir_name" "$include_archived"
    ;;
  view)
    ref="${1:-}"
    [ -n "$ref" ] || { usage; exit 1; }
    run_view "$project_root" "$board_dir_name" "$ref"
    ;;
  validate)
    ref="${1:-}"
    [ -n "$ref" ] || { usage; exit 1; }
    run_validate "$project_root" "$board_dir_name" "$ref"
    ;;
  archive)
    ref="${1:-}"
    [ -n "$ref" ] || { usage; exit 1; }
    run_archive "$project_root" "$board_dir_name" "$ref"
    ;;
  match)
    keywords_input=""
    limit=5
    while [ $# -gt 0 ]; do
      case "$1" in
        --keywords) keywords_input="${2:-}"; shift 2 ;;
        --limit) limit="${2:-5}"; shift 2 ;;
        *) echo "Unknown argument: $1" >&2; usage; exit 1 ;;
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
        --result) result="${2:-}"; shift 2 ;;
        *) echo "Unknown argument: $1" >&2; usage; exit 1 ;;
      esac
    done
    case "$result" in
      pass|fail) ;;
      *) usage; exit 1 ;;
    esac
    [ -n "$skill_ref" ] || { usage; exit 1; }
    run_update_stats "$project_root" "$board_dir_name" "$skill_ref" "$result"
    ;;
  scan)
    scan_file="${1:-}"
    shift || true
    source_ref="$scan_file"
    while [ $# -gt 0 ]; do
      case "$1" in
        --source) source_ref="${2:-}"; shift 2 ;;
        *) echo "Unknown argument: $1" >&2; usage; exit 1 ;;
      esac
    done
    [ -n "$scan_file" ] || { usage; exit 1; }
    run_scan "$project_root" "$board_dir_name" "$scan_file" "$source_ref"
    ;;
  import)
    source_ref="${1:-}"
    shift || true
    override_name=""
    override_category=""
    while [ $# -gt 0 ]; do
      case "$1" in
        --name) override_name="${2:-}"; shift 2 ;;
        --category) override_category="${2:-}"; shift 2 ;;
        *) echo "Unknown argument: $1" >&2; usage; exit 1 ;;
      esac
    done
    [ -n "$source_ref" ] || { usage; exit 1; }
    run_agentskills_import "$project_root" "$board_dir_name" "$source_ref" "$override_name" "$override_category"
    ;;
  export)
    ref="${1:-}"
    [ -n "$ref" ] || { usage; exit 1; }
    run_agentskills_export "$project_root" "$board_dir_name" "$ref"
    ;;
  cluster-detect)
    threshold_percent=70
    while [ $# -gt 0 ]; do
      case "$1" in
        --threshold-percent) threshold_percent="${2:-70}"; shift 2 ;;
        *) echo "Unknown argument: $1" >&2; usage; exit 1 ;;
      esac
    done
    run_cluster_detect "$project_root" "$board_dir_name" "$threshold_percent"
    ;;
  meta-extract)
    cluster_refs=""
    override_name=""
    override_category=""
    while [ $# -gt 0 ]; do
      case "$1" in
        --cluster) cluster_refs="${2:-}"; shift 2 ;;
        --name) override_name="${2:-}"; shift 2 ;;
        --category) override_category="${2:-}"; shift 2 ;;
        *) echo "Unknown argument: $1" >&2; usage; exit 1 ;;
      esac
    done
    [ -n "$cluster_refs" ] || { usage; exit 1; }
    run_meta_extract "$project_root" "$board_dir_name" "$cluster_refs" "$override_name" "$override_category"
    ;;
  apply)
    keywords_input=""
    deterministic_requested="false"
    while [ $# -gt 0 ]; do
      case "$1" in
        --keywords) keywords_input="${2:-}"; shift 2 ;;
        --deterministic) deterministic_requested="true"; shift ;;
        *) echo "Unknown argument: $1" >&2; usage; exit 1 ;;
      esac
    done
    [ -n "$keywords_input" ] || { usage; exit 1; }
    run_apply "$project_root" "$board_dir_name" "$keywords_input" "$deterministic_requested"
    ;;
  metrics)
    window_days=7
    while [ $# -gt 0 ]; do
      case "$1" in
        --window-days) window_days="${2:-7}"; shift 2 ;;
        *) echo "Unknown argument: $1" >&2; usage; exit 1 ;;
      esac
    done
    run_metrics "$project_root" "$board_dir_name" "$window_days"
    ;;
  curator-run)
    once="false"
    idle="false"
    now_arg=""
    while [ $# -gt 0 ]; do
      case "$1" in
        --once) once="true"; shift ;;
        --idle) idle="true"; shift ;;
        --now) now_arg="${2:-}"; shift 2 ;;
        *) echo "Unknown argument: $1" >&2; usage; exit 1 ;;
      esac
    done
    run_curator_run "$project_root" "$board_dir_name" "$once" "$idle" "$now_arg"
    ;;
  curator-status)
    run_curator_status "$project_root" "$board_dir_name"
    ;;
  auto-extract)
    ticket_ref=""
    pattern_type=""
    override_name=""
    override_category=""
    while [ $# -gt 0 ]; do
      case "$1" in
        --from-ticket) ticket_ref="${2:-}"; shift 2 ;;
        --pattern-type) pattern_type="${2:-}"; shift 2 ;;
        --name) override_name="${2:-}"; shift 2 ;;
        --category) override_category="${2:-}"; shift 2 ;;
        *) echo "Unknown argument: $1" >&2; usage; exit 1 ;;
      esac
    done
    run_auto_extract "$project_root" "$board_dir_name" "$ticket_ref" "$pattern_type" "$override_name" "$override_category"
    ;;
  *)
    echo "Unknown skill command: $subcmd" >&2
    usage
    exit 1
    ;;
esac
