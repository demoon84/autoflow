#!/usr/bin/env bash

set -euo pipefail

runner_common_script_dir() {
  cd "$(dirname "${BASH_SOURCE[0]}")" && pwd
}

runner_default_board_root() {
  local script_dir script_base project_candidate board_candidate

  script_dir="$(runner_common_script_dir)"
  script_base="$(basename "$script_dir")"

  if [ "$script_base" = "scripts" ]; then
    cd "${script_dir}/.." && pwd
    return 0
  fi

  if [ "$script_base" = "runtime" ]; then
    project_candidate="$(cd "${script_dir}/../.." && pwd)"
    board_candidate="${project_candidate}/autoflow"
    if [ -d "${board_candidate}/runners" ]; then
      printf '%s' "$board_candidate"
      return 0
    fi
  fi

  if [ -n "${BOARD_ROOT:-}" ]; then
    printf '%s' "$BOARD_ROOT"
    return 0
  fi

  if [ -n "${AUTOFLOW_BOARD_ROOT:-}" ]; then
    printf '%s' "$AUTOFLOW_BOARD_ROOT"
    return 0
  fi

  cd "${script_dir}/.." && pwd
}

runner_board_root() {
  if [ -n "${AUTOFLOW_BOARD_ROOT:-}" ]; then
    printf '%s' "$AUTOFLOW_BOARD_ROOT"
    return 0
  fi

  if [ -n "${BOARD_ROOT:-}" ]; then
    printf '%s' "$BOARD_ROOT"
    return 0
  fi

  runner_default_board_root
}

runner_config_path() {
  printf '%s/runners/config.toml' "$(runner_board_root)"
}

runner_state_dir() {
  printf '%s/runners/state' "$(runner_board_root)"
}

runner_log_dir() {
  printf '%s/runners/logs' "$(runner_board_root)"
}

runner_now_iso() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

runner_validate_id() {
  local runner_id="${1:-}"

  case "$runner_id" in
    ""|*/*|*\\*|*..*|*[!A-Za-z0-9._-]*)
      return 1
      ;;
    *)
      return 0
      ;;
  esac
}

runner_validate_key() {
  local key="${1:-}"

  case "$key" in
    ""|*[!A-Za-z0-9_.-]*)
      return 1
      ;;
    *)
      return 0
      ;;
  esac
}

runner_ensure_dirs() {
  mkdir -p "$(runner_state_dir)" "$(runner_log_dir)"
}

runner_state_path() {
  local runner_id="$1"

  runner_validate_id "$runner_id" || {
    echo "Invalid runner id: ${runner_id}" >&2
    return 1
  }

  printf '%s/%s.state' "$(runner_state_dir)" "$runner_id"
}

runner_log_path() {
  local runner_id="$1"

  runner_validate_id "$runner_id" || {
    echo "Invalid runner id: ${runner_id}" >&2
    return 1
  }

  printf '%s/%s.log' "$(runner_log_dir)" "$runner_id"
}

runner_list_config() {
  local config_path="${1:-$(runner_config_path)}"

  [ -f "$config_path" ] || return 1

  awk '
    function trim(value) {
      gsub(/^[[:space:]]+/, "", value)
      gsub(/[[:space:]]+$/, "", value)
      return value
    }

    function strip_value(value) {
      value = trim(value)
      if (value ~ /^".*"$/) {
        value = substr(value, 2, length(value) - 2)
      }
      return value
    }

    function reset_runner() {
      id = ""
      role = ""
      agent = ""
      model = ""
      reasoning = ""
      mode = ""
      enabled = "true"
      command = ""
    }

    function emit_runner() {
      if (id == "") {
        return
      }
      print "runner_begin"
      print "id=" id
      print "role=" role
      print "agent=" agent
      print "model=" model
      print "reasoning=" reasoning
      print "mode=" mode
      print "enabled=" enabled
      print "command=" command
      print "runner_end"
    }

    BEGIN {
      in_runner = 0
      reset_runner()
    }

    /^[[:space:]]*#/ || /^[[:space:]]*$/ {
      next
    }

    /^[[:space:]]*\[\[runners\]\][[:space:]]*$/ {
      if (in_runner) {
        emit_runner()
      }
      reset_runner()
      in_runner = 1
      next
    }

    in_runner && index($0, "=") > 0 {
      key = trim(substr($0, 1, index($0, "=") - 1))
      value = strip_value(substr($0, index($0, "=") + 1))

      if (key == "id") id = value
      else if (key == "role") role = value
      else if (key == "agent") agent = value
      else if (key == "model") model = value
      else if (key == "reasoning") reasoning = value
      else if (key == "mode") mode = value
      else if (key == "enabled") enabled = value
      else if (key == "command") command = value
    }

    END {
      if (in_runner) {
        emit_runner()
      }
    }
  ' "$config_path"
}

runner_config_block() {
  local wanted_id="$1"
  local config_path="${2:-$(runner_config_path)}"

  runner_validate_id "$wanted_id" || {
    echo "Invalid runner id: ${wanted_id}" >&2
    return 1
  }

  runner_list_config "$config_path" | awk -v wanted_id="$wanted_id" '
    /^runner_begin$/ {
      block = $0 "\n"
      current_id = ""
      in_block = 1
      next
    }
    /^runner_end$/ && in_block {
      block = block $0 "\n"
      if (current_id == wanted_id) {
        printf "%s", block
        found = 1
        exit
      }
      in_block = 0
      next
    }
    in_block {
      block = block $0 "\n"
      if ($0 ~ /^id=/) {
        current_id = substr($0, 4)
      }
    }
    END {
      exit(found ? 0 : 1)
    }
  '
}

runner_config_field() {
  local runner_id="$1"
  local field="$2"
  local config_path="${3:-$(runner_config_path)}"

  runner_validate_key "$field" || {
    echo "Invalid runner field: ${field}" >&2
    return 1
  }

  runner_config_block "$runner_id" "$config_path" | awk -F= -v field="$field" '
    $1 == field {
      sub(/^[^=]*=/, "", $0)
      print
      found = 1
      exit
    }
    END {
      exit(found ? 0 : 1)
    }
  '
}

runner_write_state() {
  local runner_id="$1"
  local state_path temp_file pair key value
  shift || true

  runner_validate_id "$runner_id" || {
    echo "Invalid runner id: ${runner_id}" >&2
    return 1
  }

  runner_ensure_dirs
  state_path="$(runner_state_path "$runner_id")"
  temp_file="$(mktemp "${TMPDIR:-/tmp}/autoflow-runner-state.XXXXXX")"

  {
    printf 'id=%s\n' "$runner_id"
    printf 'updated_at=%s\n' "$(runner_now_iso)"
    for pair in "$@"; do
      key="${pair%%=*}"
      value="${pair#*=}"
      runner_validate_key "$key" || {
        rm -f "$temp_file"
        echo "Invalid runner state key: ${key}" >&2
        return 1
      }
      printf '%s=%s\n' "$key" "$value"
    done
  } > "$temp_file"

  mv "$temp_file" "$state_path"
}

runner_state_field() {
  local runner_id="$1"
  local field="$2"
  local state_path

  runner_validate_key "$field" || {
    echo "Invalid runner state field: ${field}" >&2
    return 1
  }

  state_path="$(runner_state_path "$runner_id")"
  [ -f "$state_path" ] || return 1

  awk -F= -v field="$field" '
    $1 == field {
      sub(/^[^=]*=/, "", $0)
      print
      found = 1
      exit
    }
    END {
      exit(found ? 0 : 1)
    }
  ' "$state_path"
}

runner_append_log() {
  local runner_id="$1"
  local event="$2"
  local log_path pair key value
  shift 2 || true

  runner_validate_id "$runner_id" || {
    echo "Invalid runner id: ${runner_id}" >&2
    return 1
  }

  for pair in "$@"; do
    key="${pair%%=*}"
    runner_validate_key "$key" || {
      echo "Invalid runner log key: ${key}" >&2
      return 1
    }
  done

  runner_ensure_dirs
  log_path="$(runner_log_path "$runner_id")"
  {
    printf 'timestamp=%s event=%s runner_id=%s' "$(runner_now_iso)" "$event" "$runner_id"
    for pair in "$@"; do
      key="${pair%%=*}"
      value="${pair#*=}"
      printf ' %s=%s' "$key" "$value"
    done
    printf '\n'
  } >> "$log_path"
}
