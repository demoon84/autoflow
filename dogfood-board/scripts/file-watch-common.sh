#!/usr/bin/env bash

set -euo pipefail

file_watch_default_config_path() {
  printf '%s/automations/file-watch.psd1' "$BOARD_ROOT"
}

file_watch_parse_value() {
  local raw="${1:-}"
  raw="$(trim_spaces "$raw")"

  case "$raw" in
    \$true|\$TRUE)
      printf 'true'
      ;;
    \$false|\$FALSE)
      printf 'false'
      ;;
    \'*\')
      printf '%s' "${raw#\'}" | sed "s/'$//"
      ;;
    \"*\")
      printf '%s' "${raw#\"}" | sed 's/"$//'
      ;;
    *)
      printf '%s' "$raw"
      ;;
  esac
}

file_watch_global_setting() {
  local config_path="$1"
  local key="$2"
  local default_value="${3:-}"
  local raw

  if [ ! -f "$config_path" ]; then
    printf '%s' "$default_value"
    return 0
  fi

  raw="$(
    awk -v key="$key" '
      /^[[:space:]]*Routes[[:space:]]*=[[:space:]]*@\{/ { exit }
      {
        line=$0
        sub(/#.*/, "", line)
        if (line ~ "^[[:space:]]*" key "[[:space:]]*=") {
          sub("^[[:space:]]*" key "[[:space:]]*=[[:space:]]*", "", line)
          print line
          exit
        }
      }
    ' "$config_path"
  )"

  if [ -z "$raw" ]; then
    printf '%s' "$default_value"
    return 0
  fi

  file_watch_parse_value "$raw"
}

file_watch_route_setting() {
  local config_path="$1"
  local route_name="$2"
  local key="$3"
  local default_value="${4:-}"
  local raw

  if [ ! -f "$config_path" ]; then
    printf '%s' "$default_value"
    return 0
  fi

  raw="$(
    awk -v route="$route_name" -v key="$key" '
      BEGIN {
        in_routes = 0
        in_route = 0
      }

      {
        line = $0
        sub(/#.*/, "", line)
      }

      !in_routes && line ~ /^[[:space:]]*Routes[[:space:]]*=[[:space:]]*@\{/ {
        in_routes = 1
        next
      }

      in_routes && !in_route && line ~ /^[[:space:]]*}[[:space:]]*$/ {
        exit
      }

      in_routes && !in_route && line ~ "^[[:space:]]*" route "[[:space:]]*=[[:space:]]*@\\{" {
        in_route = 1
        next
      }

      in_route && line ~ /^[[:space:]]*}[[:space:]]*$/ {
        exit
      }

      in_route && line ~ "^[[:space:]]*" key "[[:space:]]*=" {
        sub("^[[:space:]]*" key "[[:space:]]*=[[:space:]]*", "", line)
        print line
        exit
      }
    ' "$config_path"
  )"

  if [ -z "$raw" ]; then
    printf '%s' "$default_value"
    return 0
  fi

  file_watch_parse_value "$raw"
}

file_watch_route_enabled() {
  local config_path="$1"
  local route_name="$2"
  local enabled

  enabled="$(file_watch_route_setting "$config_path" "$route_name" "Enabled" "true")"
  case "$enabled" in
    true|TRUE|1|yes|YES|on|ON)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

portable_stat_signature() {
  local path="$1"

  if stat -f '%m|%z' "$path" >/dev/null 2>&1; then
    stat -f '%m|%z' "$path"
    return 0
  fi

  stat -c '%Y|%s' "$path"
}

now_epoch_ms() {
  if command -v python3 >/dev/null 2>&1; then
    python3 - <<'PY'
import time
print(int(time.time() * 1000))
PY
    return 0
  fi

  if command -v python >/dev/null 2>&1; then
    python - <<'PY'
import time
print(int(time.time() * 1000))
PY
    return 0
  fi

  if command -v perl >/dev/null 2>&1; then
    perl -MTime::HiRes=time -e 'print int(time() * 1000), "\n"'
    return 0
  fi

  printf '%s000\n' "$(date +%s)"
}

ms_to_sleep_seconds() {
  local ms="${1:-0}"

  if command -v python3 >/dev/null 2>&1; then
    python3 - "$ms" <<'PY'
import sys
print(f"{int(sys.argv[1]) / 1000:.3f}")
PY
    return 0
  fi

  if command -v python >/dev/null 2>&1; then
    python - "$ms" <<'PY'
import sys
print(f"{int(sys.argv[1]) / 1000:.3f}")
PY
    return 0
  fi

  if command -v perl >/dev/null 2>&1; then
    perl -e 'printf "%.3f\n", ($ARGV[0] / 1000)' "$ms"
    return 0
  fi

  printf '%s\n' "$((ms / 1000))"
}
