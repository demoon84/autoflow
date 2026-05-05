#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/cli-common.sh"

usage() {
  cat <<'EOF' >&2
Usage:
  telemetry-project.sh [--project-root PATH] self-test
  telemetry-project.sh [--project-root PATH] record [JSON on stdin] [--runner RUNNER_ID] [--result success|failed|killed] [--started-at TIMESTAMP] [--ended-at TIMESTAMP] [--duration-ms MILLISECONDS]
  telemetry-project.sh [--project-root PATH] query [--target runs|failures] [--runner RUNNER_ID] [--result success|failed|killed] [--since TIMESTAMP] [--until TIMESTAMP] [--limit N] [--prd-key KEY] [--ticket-id ID]
  telemetry-project.sh [--project-root PATH] token-usage --runner RUNNER_ID [--since TIMESTAMP] [--until TIMESTAMP]
  telemetry-project.sh [--project-root PATH] compact --before YYYY-MM-DD
EOF
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    printf 'error=missing_%s\n' "$cmd"
    return 1
  fi
}

ensure_telemetry_file() {
  local path="$1"
  mkdir -p "$(dirname "$path")"
  [ -f "$path" ] || : > "$path"
}

json_string_value() {
  local json="$1"
  local key="$2"
  [ -n "$json" ] || return 0
  printf '%s\n' "$json" | jq -r --arg key "$key" '.[$key] // empty' 2>/dev/null || true
}

json_number_or_zero() {
  local value="$1"
  case "$value" in
    ''|*[!0-9]*) printf '0' ;;
    *) printf '%s' "$value" ;;
  esac
}

telemetry_token_usage_max_row_tokens() {
  local value="${AUTOFLOW_TELEMETRY_MAX_ROW_TOKENS:-100000000}"
  case "$value" in
    ''|*[!0-9]*|0) value=100000000 ;;
  esac
  printf '%s' "$value"
}

append_jsonl_with_lock() {
  local target_path="$1"
  local row="$2"
  local lock_path lock_dir waited

  ensure_telemetry_file "$target_path"
  lock_path="${target_path}.lock"
  if command -v flock >/dev/null 2>&1; then
    {
      flock 9
      printf '%s\n' "$row" >> "$target_path"
    } 9>"$lock_path"
    return 0
  fi

  lock_dir="${lock_path}.d"
  waited=0
  until mkdir "$lock_dir" 2>/dev/null; do
    waited=$((waited + 1))
    [ "$waited" -lt 100 ] || return 1
    sleep 0.05
  done
  trap 'rm -rf "$lock_dir"' RETURN
  printf '%s\n' "$row" >> "$target_path"
  rm -rf "$lock_dir"
  trap - RETURN
}

telemetry_record() {
  local project_root="."
  local stdin_json=""
  local runner_id=""
  local result=""
  local started_at=""
  local ended_at=""
  local duration_ms=""
  local failure_class=""
  local token_input=""
  local token_output=""
  local ticket_id=""
  local prd_key=""
  local model=""
  local prompt_template_hash=""
  local stdout_bytes=""
  local stderr_bytes=""
  local key row runs_path failures_path

  if [ ! -t 0 ]; then
    stdin_json="$(cat || true)"
    if [ -n "$stdin_json" ] && ! printf '%s\n' "$stdin_json" | jq -e 'type == "object"' >/dev/null 2>&1; then
      printf 'error=invalid_stdin_json\n'
      return 1
    fi
  fi

  runner_id="$(json_string_value "$stdin_json" runner_id)"
  result="$(json_string_value "$stdin_json" result)"
  started_at="$(json_string_value "$stdin_json" started_at)"
  ended_at="$(json_string_value "$stdin_json" ended_at)"
  duration_ms="$(json_string_value "$stdin_json" duration_ms)"
  failure_class="$(json_string_value "$stdin_json" failure_class)"
  token_input="$(json_string_value "$stdin_json" token_input)"
  token_output="$(json_string_value "$stdin_json" token_output)"
  ticket_id="$(json_string_value "$stdin_json" ticket_id)"
  prd_key="$(json_string_value "$stdin_json" prd_key)"
  model="$(json_string_value "$stdin_json" model)"
  prompt_template_hash="$(json_string_value "$stdin_json" prompt_template_hash)"
  stdout_bytes="$(json_string_value "$stdin_json" stdout_bytes)"
  stderr_bytes="$(json_string_value "$stdin_json" stderr_bytes)"

  while [ "$#" -gt 0 ]; do
    key="$1"
    shift || true
    case "$key" in
      --project-root) project_root="$1"; shift || true ;;
      --project-root=*) project_root="${key#*=}" ;;
      --runner|--runner-id) runner_id="$1"; shift || true ;;
      --runner=*|--runner-id=*) runner_id="${key#*=}" ;;
      --result) result="$1"; shift || true ;;
      --result=*) result="${key#*=}" ;;
      --started-at) started_at="$1"; shift || true ;;
      --started-at=*) started_at="${key#*=}" ;;
      --ended-at) ended_at="$1"; shift || true ;;
      --ended-at=*) ended_at="${key#*=}" ;;
      --duration-ms) duration_ms="$1"; shift || true ;;
      --duration-ms=*) duration_ms="${key#*=}" ;;
      --failure-class) failure_class="$1"; shift || true ;;
      --failure-class=*) failure_class="${key#*=}" ;;
      --token-input) token_input="$1"; shift || true ;;
      --token-input=*) token_input="${key#*=}" ;;
      --token-output) token_output="$1"; shift || true ;;
      --token-output=*) token_output="${key#*=}" ;;
      --ticket-id) ticket_id="$1"; shift || true ;;
      --ticket-id=*) ticket_id="${key#*=}" ;;
      --prd-key) prd_key="$1"; shift || true ;;
      --prd-key=*) prd_key="${key#*=}" ;;
      --model) model="$1"; shift || true ;;
      --model=*) model="${key#*=}" ;;
      --prompt-template-hash) prompt_template_hash="$1"; shift || true ;;
      --prompt-template-hash=*) prompt_template_hash="${key#*=}" ;;
      --stdout-bytes) stdout_bytes="$1"; shift || true ;;
      --stdout-bytes=*) stdout_bytes="${key#*=}" ;;
      --stderr-bytes) stderr_bytes="$1"; shift || true ;;
      --stderr-bytes=*) stderr_bytes="${key#*=}" ;;
      *) printf 'error=unknown_option\noption=%s\n' "$key"; return 1 ;;
    esac
  done

  if [ -z "$runner_id" ] || [ -z "$result" ] || [ -z "$started_at" ] || [ -z "$ended_at" ]; then
    printf 'error=missing_required_record_fields\n'
    return 1
  fi

  case "$result" in
    success|failed|killed) ;;
    *) printf 'error=invalid_result\n'; return 1 ;;
  esac

  duration_ms="$(json_number_or_zero "$duration_ms")"
  token_input="$(json_number_or_zero "$token_input")"
  token_output="$(json_number_or_zero "$token_output")"
  stdout_bytes="$(json_number_or_zero "$stdout_bytes")"
  stderr_bytes="$(json_number_or_zero "$stderr_bytes")"
  if [ "$result" != "success" ] && [ -z "$failure_class" ]; then
    failure_class="unknown_failure_class"
  fi

  require_cmd jq || return 1
  row="$(jq -cn \
    --arg runner_id "$runner_id" \
    --arg started_at "$started_at" \
    --arg ended_at "$ended_at" \
    --arg result "$result" \
    --arg failure_class "$failure_class" \
    --arg ticket_id "$ticket_id" \
    --arg prd_key "$prd_key" \
    --arg model "$model" \
    --arg prompt_template_hash "$prompt_template_hash" \
    --argjson duration_ms "$duration_ms" \
    --argjson token_input "$token_input" \
    --argjson token_output "$token_output" \
    --argjson stdout_bytes "$stdout_bytes" \
    --argjson stderr_bytes "$stderr_bytes" \
    '{
      event_version: 1,
      runner_id: $runner_id,
      started_at: $started_at,
      ended_at: $ended_at,
      duration_ms: $duration_ms,
      result: $result,
      failure_class: $failure_class,
      token_input: $token_input,
      token_output: $token_output,
      ticket_id: $ticket_id,
      prd_key: $prd_key,
      model: $model,
      prompt_template_hash: $prompt_template_hash,
      stdout_bytes: $stdout_bytes,
      stderr_bytes: $stderr_bytes
    } | with_entries(select(.value != ""))')"

  runs_path="$(telemetry_runs_jsonl_path "$project_root")"
  failures_path="$(telemetry_failures_jsonl_path "$project_root")"
  append_jsonl_with_lock "$runs_path" "$row"
  if [ "$result" = "failed" ] || [ "$result" = "killed" ]; then
    append_jsonl_with_lock "$failures_path" "$row"
  fi

  printf 'telemetry_record_status=ok\n'
  printf 'target=%s\n' "$runs_path"
}

telemetry_query() {
  local project_root="."
  local target="runs"
  local runner_filter=""
  local result_filter=""
  local since=""
  local until=""
  local limit=10
  local prd_key_filter=""
  local ticket_id_filter=""
  local since_epoch=""
  local until_epoch=""
  local target_file sort_tmp line ended_at ended_epoch valid
  local key runner_id result prd_key ticket_id

  while [ "$#" -gt 0 ]; do
    key="$1"
    shift || true
    case "$key" in
      --project-root) project_root="$1"; shift || true ;;
      --project-root=*) project_root="${key#*=}" ;;
      --target) target="$1"; shift || true ;;
      --target=*) target="${key#*=}" ;;
      --runner) runner_filter="$1"; shift || true ;;
      --runner=*) runner_filter="${key#*=}" ;;
      --result) result_filter="$1"; shift || true ;;
      --result=*) result_filter="${key#*=}" ;;
      --since) since="$1"; shift || true ;;
      --since=*) since="${key#*=}" ;;
      --until) until="$1"; shift || true ;;
      --until=*) until="${key#*=}" ;;
      --limit) limit="$1"; shift || true ;;
      --limit=*) limit="${key#*=}" ;;
      --prd-key) prd_key_filter="$1"; shift || true ;;
      --prd-key=*) prd_key_filter="${key#*=}" ;;
      --ticket-id) ticket_id_filter="$1"; shift || true ;;
      --ticket-id=*) ticket_id_filter="${key#*=}" ;;
      *) printf 'error=unknown_option\noption=%s\n' "$key"; return 1 ;;
    esac
  done

  if ! [ "$limit" -gt 0 ] 2>/dev/null; then
    limit=10
  fi

  case "$target" in
    runs) target_file="$(telemetry_runs_jsonl_path "$project_root")" ;;
    failures) target_file="$(telemetry_failures_jsonl_path "$project_root")" ;;
    *) printf 'error=invalid_target\n'; return 1 ;;
  esac

  require_cmd jq || return 1
  [ -z "$since" ] || since_epoch="$(telemetry_timestamp_to_epoch "$since" || true)"
  [ -z "$until" ] || until_epoch="$(telemetry_timestamp_to_epoch "$until" || true)"
  if { [ -n "$since" ] && [ -z "$since_epoch" ]; } || { [ -n "$until" ] && [ -z "$until_epoch" ]; }; then
    printf 'error=invalid_time_filter\n'
    return 1
  fi

  [ -f "$target_file" ] || return 0
  sort_tmp="$(mktemp)"
  while IFS= read -r line || [ -n "$line" ]; do
    [ -n "$line" ] || continue
    if ! printf '%s\n' "$line" | jq -e 'type == "object"' >/dev/null 2>&1; then
      printf 'warning=skip_corrupt_jsonl_line target=%s\n' "$target" >&2
      continue
    fi

    valid="$(printf '%s\n' "$line" | jq -r 'has("event_version") and has("runner_id") and has("started_at") and has("ended_at") and has("duration_ms") and has("result")')"
    [ "$valid" = "true" ] || continue

    runner_id="$(printf '%s\n' "$line" | jq -r '.runner_id')"
    result="$(printf '%s\n' "$line" | jq -r '.result')"
    prd_key="$(printf '%s\n' "$line" | jq -r '.prd_key // empty')"
    ticket_id="$(printf '%s\n' "$line" | jq -r '.ticket_id // empty')"
    ended_at="$(printf '%s\n' "$line" | jq -r '.ended_at')"
    ended_epoch="$(telemetry_timestamp_to_epoch "$ended_at" || true)"
    [ -n "$ended_epoch" ] || continue

    [ -z "$runner_filter" ] || [ "$runner_id" = "$runner_filter" ] || continue
    [ -z "$result_filter" ] || [ "$result" = "$result_filter" ] || continue
    [ -z "$prd_key_filter" ] || [ "$prd_key" = "$prd_key_filter" ] || continue
    [ -z "$ticket_id_filter" ] || [ "$ticket_id" = "$ticket_id_filter" ] || continue
    [ -z "$since_epoch" ] || [ "$ended_epoch" -ge "$since_epoch" ] || continue
    [ -z "$until_epoch" ] || [ "$ended_epoch" -le "$until_epoch" ] || continue

    printf '%s\t%s\n' "$ended_at" "$line" >> "$sort_tmp"
  done < "$target_file"

  if [ -s "$sort_tmp" ]; then
    LC_ALL=C sort -t$'\t' -k1,1 -r "$sort_tmp" | head -n "$limit" | cut -f2-
  fi
  rm -f "$sort_tmp"
}

telemetry_token_usage() {
  local project_root="."
  local runner_filter=""
  local since=""
  local until=""
  local since_epoch=""
  local until_epoch=""
  local target_file line runner_id ended_at ended_epoch valid
  local input output row_total total max_row_tokens skipped_suspicious_rows
  local key

  while [ "$#" -gt 0 ]; do
    key="$1"
    shift || true
    case "$key" in
      --project-root) project_root="$1"; shift || true ;;
      --project-root=*) project_root="${key#*=}" ;;
      --runner) runner_filter="$1"; shift || true ;;
      --runner=*) runner_filter="${key#*=}" ;;
      --since) since="$1"; shift || true ;;
      --since=*) since="${key#*=}" ;;
      --until) until="$1"; shift || true ;;
      --until=*) until="${key#*=}" ;;
      *) printf 'error=unknown_option\noption=%s\n' "$key"; return 1 ;;
    esac
  done

  if [ -z "$runner_filter" ]; then
    printf 'error=missing_runner\n'
    return 1
  fi

  require_cmd jq || return 1
  [ -z "$since" ] || since_epoch="$(telemetry_timestamp_to_epoch "$since" || true)"
  [ -z "$until" ] || until_epoch="$(telemetry_timestamp_to_epoch "$until" || true)"
  if { [ -n "$since" ] && [ -z "$since_epoch" ]; } || { [ -n "$until" ] && [ -z "$until_epoch" ]; }; then
    printf 'error=invalid_time_filter\n'
    return 1
  fi

  target_file="$(telemetry_runs_jsonl_path "$project_root")"
  total=0
  skipped_suspicious_rows=0
  max_row_tokens="$(telemetry_token_usage_max_row_tokens)"
  if [ -f "$target_file" ]; then
    while IFS= read -r line || [ -n "$line" ]; do
      [ -n "$line" ] || continue
      if ! printf '%s\n' "$line" | jq -e 'type == "object"' >/dev/null 2>&1; then
        printf 'warning=skip_corrupt_jsonl_line target=runs\n' >&2
        continue
      fi
      valid="$(printf '%s\n' "$line" | jq -r 'has("runner_id") and has("ended_at")')"
      [ "$valid" = "true" ] || continue

      runner_id="$(printf '%s\n' "$line" | jq -r '.runner_id')"
      [ "$runner_id" = "$runner_filter" ] || continue
      ended_at="$(printf '%s\n' "$line" | jq -r '.ended_at // empty')"
      ended_epoch="$(telemetry_timestamp_to_epoch "$ended_at" || true)"
      [ -n "$ended_epoch" ] || continue
      [ -z "$since_epoch" ] || [ "$ended_epoch" -ge "$since_epoch" ] || continue
      [ -z "$until_epoch" ] || [ "$ended_epoch" -le "$until_epoch" ] || continue

      input="$(printf '%s\n' "$line" | jq -r '.token_input // 0')"
      output="$(printf '%s\n' "$line" | jq -r '.token_output // 0')"
      input="$(json_number_or_zero "$input")"
      output="$(json_number_or_zero "$output")"
      row_total=$((input + output))
      if [ "$input" -ge "$max_row_tokens" ] || [ "$output" -ge "$max_row_tokens" ] || [ "$row_total" -ge "$max_row_tokens" ]; then
        skipped_suspicious_rows=$((skipped_suspicious_rows + 1))
        printf 'warning=skip_suspicious_token_row target=runs runner_id=%s ended_at=%s token_input=%s token_output=%s row_total=%s max_row_tokens=%s\n' \
          "$runner_id" "$ended_at" "$input" "$output" "$row_total" "$max_row_tokens" >&2
        continue
      fi
      total=$((total + row_total))
    done < "$target_file"
  fi

  printf 'runner_id=%s\n' "$runner_filter"
  printf 'since=%s\n' "$since"
  printf 'until=%s\n' "$until"
  printf 'token_usage=%s\n' "$total"
  printf 'token_usage_trusted=%s\n' "$([ "$skipped_suspicious_rows" -eq 0 ] && printf 'true' || printf 'false')"
  printf 'skipped_suspicious_token_rows=%s\n' "$skipped_suspicious_rows"
  printf 'token_usage_max_row_tokens=%s\n' "$max_row_tokens"
}

compact_one_file() {
  local project_root="$1"
  local source_path="$2"
  local archive_prefix="$3"
  local cutoff_epoch="$4"
  local work_dir keep_file line started_at started_epoch month archive_file archive_path combined
  local archived_count=0
  local archive_path_selected=""

  ensure_telemetry_file "$source_path"
  work_dir="$(mktemp -d)"
  keep_file="$(mktemp)"

  while IFS= read -r line || [ -n "$line" ]; do
    [ -n "$line" ] || continue
    if ! printf '%s\n' "$line" | jq -e 'type == "object"' >/dev/null 2>&1; then
      printf '%s\n' "$line" >> "$keep_file"
      continue
    fi

    started_at="$(printf '%s\n' "$line" | jq -r '.started_at // empty')"
    started_epoch="$(telemetry_timestamp_to_epoch "$started_at" || true)"
    if [ -z "$started_epoch" ] || [ "$started_epoch" -ge "$cutoff_epoch" ]; then
      printf '%s\n' "$line" >> "$keep_file"
      continue
    fi

    month="$(printf '%s\n' "$started_at" | cut -c1-7)"
    if ! printf '%s\n' "$month" | grep -Eq '^[0-9]{4}-[0-9]{2}$'; then
      printf '%s\n' "$line" >> "$keep_file"
      continue
    fi
    printf '%s\n' "$line" >> "${work_dir}/${month}.jsonl"
  done < "$source_path"

  while IFS= read -r archive_file; do
    [ -n "$archive_file" ] || continue
    month="$(basename "$archive_file" .jsonl)"
    archive_path="$(telemetry_root_path "$project_root")/${archive_prefix}.${month}.jsonl.gz"
    combined="$(mktemp)"
    if [ -f "$archive_path" ]; then
      gzip -cd "$archive_path" > "$combined" 2>/dev/null || : > "$combined"
    fi
    cat "$archive_file" >> "$combined"
    gzip -c "$combined" > "$archive_path"
    rm -f "$combined"
    [ -n "$archive_path_selected" ] || archive_path_selected="$archive_path"
    archived_count=$((archived_count + $(wc -l < "$archive_file" | tr -d ' ')))
  done < <(find "$work_dir" -type f -name '*.jsonl' -print | sort)

  mv "$keep_file" "$source_path"
  rm -rf "$work_dir"

  printf '%s\t%s\n' "$archived_count" "$archive_path_selected"
}

telemetry_compact() {
  local project_root="."
  local before=""
  local cutoff_epoch=""
  local key runs_result failures_result runs_count failures_count runs_archive failures_archive
  local archived_count archive_path lock_path

  while [ "$#" -gt 0 ]; do
    key="$1"
    shift || true
    case "$key" in
      --project-root) project_root="$1"; shift || true ;;
      --project-root=*) project_root="${key#*=}" ;;
      --before) before="$1"; shift || true ;;
      --before=*) before="${key#*=}" ;;
      *) printf 'error=unknown_option\noption=%s\n' "$key"; return 1 ;;
    esac
  done

  if [ -z "$before" ]; then
    printf 'error=missing_before\n'
    return 1
  fi
  cutoff_epoch="$(telemetry_timestamp_to_epoch "$before" || true)"
  if [ -z "$cutoff_epoch" ]; then
    printf 'error=invalid_before\n'
    return 1
  fi

  require_cmd jq || return 1
  require_cmd gzip || return 1
  mkdir -p "$(telemetry_root_path "$project_root")"
  lock_path="$(telemetry_root_path "$project_root")/compact.lock"
  if command -v flock >/dev/null 2>&1; then
    {
      flock 9
      runs_result="$(compact_one_file "$project_root" "$(telemetry_runs_jsonl_path "$project_root")" runs "$cutoff_epoch")"
      failures_result="$(compact_one_file "$project_root" "$(telemetry_failures_jsonl_path "$project_root")" failures "$cutoff_epoch")"
    } 9>"$lock_path"
  else
    local lock_dir waited
    lock_dir="${lock_path}.d"
    waited=0
    until mkdir "$lock_dir" 2>/dev/null; do
      waited=$((waited + 1))
      [ "$waited" -lt 100 ] || return 1
      sleep 0.05
    done
    trap 'rm -rf "$lock_dir"' RETURN
    runs_result="$(compact_one_file "$project_root" "$(telemetry_runs_jsonl_path "$project_root")" runs "$cutoff_epoch")"
    failures_result="$(compact_one_file "$project_root" "$(telemetry_failures_jsonl_path "$project_root")" failures "$cutoff_epoch")"
    rm -rf "$lock_dir"
    trap - RETURN
  fi

  runs_count="$(printf '%s\n' "$runs_result" | cut -f1)"
  runs_archive="$(printf '%s\n' "$runs_result" | cut -f2-)"
  failures_count="$(printf '%s\n' "$failures_result" | cut -f1)"
  failures_archive="$(printf '%s\n' "$failures_result" | cut -f2-)"
  archived_count=$((runs_count + failures_count))
  archive_path="$runs_archive"
  [ -n "$archive_path" ] || archive_path="$failures_archive"

  printf 'archived_count=%s\n' "$archived_count"
  printf 'archive_path=%s\n' "$archive_path"
}

telemetry_self_test() {
  local test_root now old run_path failures_path query_count compact_out archive_path corrupt_query_count compact_count

  require_cmd jq || return 1
  require_cmd gzip || return 1
  test_root="$(mktemp -d)"
  now="$(runner_now_iso 2>/dev/null || date -u +%Y-%m-%dT%H:%M:%SZ)"
  old="2026-04-01T00:00:00Z"

  telemetry_record --project-root "$test_root" --runner worker --result success --started-at "$now" --ended-at "$now" --duration-ms 123 --ticket-id tickets_120 --prd-key prd_121 >/dev/null
  telemetry_record --project-root "$test_root" --runner worker --result failed --started-at "$now" --ended-at "$now" --duration-ms 456 --failure-class adapter_exit_1 >/dev/null
  printf '{"runner_id":"wiki","result":"killed","started_at":"%s","ended_at":"%s","duration_ms":789,"failure_class":"adapter_timeout"}\n' "$old" "$old" |
    telemetry_record --project-root "$test_root" >/dev/null

  run_path="$(telemetry_runs_jsonl_path "$test_root")"
  failures_path="$(telemetry_failures_jsonl_path "$test_root")"
  [ "$(wc -l < "$run_path" | tr -d ' ')" = "3" ] || { rm -rf "$test_root"; printf 'self_test_status=runs_count_mismatch\n'; return 1; }
  [ "$(wc -l < "$failures_path" | tr -d ' ')" = "2" ] || { rm -rf "$test_root"; printf 'self_test_status=failures_count_mismatch\n'; return 1; }

  query_count="$(telemetry_query --project-root "$test_root" --runner worker --result success --limit 10 | jq -sc 'length')"
  [ "$query_count" = "1" ] || { rm -rf "$test_root"; printf 'self_test_status=query_filter_failed\n'; return 1; }

  printf '{invalid\n' >> "$run_path"
  corrupt_query_count="$(telemetry_query --project-root "$test_root" --limit 5 >/tmp/telemetry-selftest-query.$$ 2>/dev/null; jq -sc 'length' /tmp/telemetry-selftest-query.$$)"
  rm -f /tmp/telemetry-selftest-query.$$
  [ "$corrupt_query_count" = "3" ] || { rm -rf "$test_root"; printf 'self_test_status=corrupt_skip_failed\n'; return 1; }

  compact_out="$(telemetry_compact --project-root "$test_root" --before 2026-04-15)"
  compact_count="$(printf '%s\n' "$compact_out" | awk -F= '/^archived_count=/{print $2}')"
  archive_path="$(printf '%s\n' "$compact_out" | awk -F= '/^archive_path=/{print $2}')"
  [ "$compact_count" -ge 1 ] || { rm -rf "$test_root"; printf 'self_test_status=compact_count_failed\n'; return 1; }
  [ -f "$archive_path" ] || { rm -rf "$test_root"; printf 'self_test_status=compact_archive_missing\n'; return 1; }
  ! grep -q '2026-04-01T00:00:00Z' "$run_path" || { rm -rf "$test_root"; printf 'self_test_status=compact_keep_failed\n'; return 1; }

  rm -rf "$test_root"
  printf 'self_test_status=ok\n'
}

main() {
  local subcmd="${1:-}"
  local project_root="."

  if [ "$subcmd" = "--project-root" ] || [ "${subcmd#--project-root=}" != "$subcmd" ]; then
    case "$subcmd" in
      --project-root) shift || true; project_root="${1:-.}"; shift || true ;;
      --project-root=*) project_root="${subcmd#*=}"; shift || true ;;
    esac
    subcmd="${1:-}"
  fi

  case "$subcmd" in
    self-test) telemetry_self_test ;;
    record) shift || true; telemetry_record --project-root "$project_root" "$@" ;;
    query) shift || true; telemetry_query --project-root "$project_root" "$@" ;;
    token-usage) shift || true; telemetry_token_usage --project-root "$project_root" "$@" ;;
    compact) shift || true; telemetry_compact --project-root "$project_root" "$@" ;;
    *) usage; exit 1 ;;
  esac
}

main "$@"
