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

  usage_file="$(usage_json_path "$project_root" "$board_dir_name")"
  usage_record_event "$usage_file" "${category}/${skill_name}" "register" || true

  rel_path="$(board_rel_path "$board_root" "$skill_md")"
  printf 'status=ok\n'
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
  *)
    echo "Unknown skill command: $subcmd" >&2
    usage
    exit 1
    ;;
esac
