#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

tmp_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

extract_protocol_list() {
  local file="$1"
  local heading="$2"

  awk -v heading="$heading" '
    $0 == heading { capture=1; next }
    capture && /^## / { exit }
    capture && /^[[:space:]]*-[[:space:]]*`/ { print }
  ' "$file" | sed -E 's/^[[:space:]]*-[[:space:]]*`([^`]+)`.*/\1/' | sort
}

extract_guard_array() {
  local file="$1"
  local array_name="$2"

  perl -0ne '
    BEGIN {
      $array_name = shift @ARGV;
    }
    if (/\Q$array_name\E=\((.*?)\)/s) {
      my $body = $1;
      $body =~ s/#.*//g;
      while ($body =~ /([A-Za-z0-9_-]+)/g) {
        print "$1\n";
      }
    }
  ' "$array_name" "$file" | sort
}

assert_same_file() {
  local expected="$1"
  local actual="$2"
  local label="$3"

  if ! diff -u "$expected" "$actual" >/dev/null; then
    echo "Recovery protocol/guard enum mismatch: $label" >&2
    diff -u "$expected" "$actual" >&2 || true
    exit 1
  fi
}

protocol_statuses="${tmp_dir}/protocol-statuses.txt"
protocol_classes="${tmp_dir}/protocol-classes.txt"
scaffold_statuses="${tmp_dir}/scaffold-statuses.txt"
scaffold_classes="${tmp_dir}/scaffold-classes.txt"
runtime_statuses="${tmp_dir}/runtime-statuses.txt"
runtime_classes="${tmp_dir}/runtime-classes.txt"
board_statuses="${tmp_dir}/board-statuses.txt"
board_classes="${tmp_dir}/board-classes.txt"

extract_protocol_list "${REPO_ROOT}/.autoflow/protocols/recovery.md" '`Status` values:' > "$protocol_statuses"
extract_protocol_list "${REPO_ROOT}/.autoflow/protocols/recovery.md" '## Failure Classes' > "$protocol_classes"
extract_protocol_list "${REPO_ROOT}/scaffold/board/protocols/recovery.md" '`Status` values:' > "$scaffold_statuses"
extract_protocol_list "${REPO_ROOT}/scaffold/board/protocols/recovery.md" '## Failure Classes' > "$scaffold_classes"

extract_guard_array "${REPO_ROOT}/runtime/board-scripts/board-guard.sh" 'valid_statuses' > "$runtime_statuses"
extract_guard_array "${REPO_ROOT}/runtime/board-scripts/board-guard.sh" 'valid_failure_classes' > "$runtime_classes"
extract_guard_array "${REPO_ROOT}/.autoflow/scripts/board-guard.sh" 'valid_statuses' > "$board_statuses"
extract_guard_array "${REPO_ROOT}/.autoflow/scripts/board-guard.sh" 'valid_failure_classes' > "$board_classes"

assert_same_file "$protocol_statuses" "$scaffold_statuses" "protocol status scaffold copy"
assert_same_file "$protocol_classes" "$scaffold_classes" "protocol failure-class scaffold copy"
assert_same_file "$protocol_statuses" "$runtime_statuses" "runtime guard statuses"
assert_same_file "$protocol_classes" "$runtime_classes" "runtime guard failure classes"
assert_same_file "$protocol_statuses" "$board_statuses" "dogfood guard statuses"
assert_same_file "$protocol_classes" "$board_classes" "dogfood guard failure classes"

echo "status=ok"
