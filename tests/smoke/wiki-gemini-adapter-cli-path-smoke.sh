#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

project_dir="$(mktemp -d)"
stub_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$project_dir" "$stub_dir"
}
trap cleanup EXIT

require_line() {
  local file="$1"
  local expected="$2"

  if ! grep -Fqx -- "$expected" "$file"; then
    echo "Expected line not found: $expected" >&2
    echo "--- $file ---" >&2
    cat "$file" >&2
    exit 1
  fi
}

cat > "${stub_dir}/gemini" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail

printf 'adapter=gemini\n' >> "${AUTOFLOW_PROJECT_ROOT}/gemini-env.log"
printf 'autoflow_cli=%s\n' "${AUTOFLOW_CLI:-}" >> "${AUTOFLOW_PROJECT_ROOT}/gemini-env.log"
if command -v autoflow >/dev/null 2>&1; then
  printf 'autoflow_on_path=true\n' >> "${AUTOFLOW_PROJECT_ROOT}/gemini-env.log"
else
  printf 'autoflow_on_path=false\n' >> "${AUTOFLOW_PROJECT_ROOT}/gemini-env.log"
fi

if [[ "$*" == *semantic_finding* ]]; then
  printf 'semantic_finding.none=true\n'
else
  printf 'synth_answer=Gemini adapter smoke passed.\n'
  printf 'synth_citation.1=wiki/features/gemini-smoke.md\n'
fi
STUB
chmod +x "${stub_dir}/gemini"

"${REPO_ROOT}/bin/autoflow" init "$project_dir" >/dev/null
"${REPO_ROOT}/bin/autoflow" runners set wiki "$project_dir" .autoflow \
  agent=gemini \
  model=gemini-2.5-pro \
  reasoning= >/dev/null

mkdir -p "${project_dir}/.autoflow/wiki/features"
cat > "${project_dir}/.autoflow/wiki/features/gemini-smoke.md" <<'WIKI'
# Gemini Smoke

wiki bot gemini smoke proves the Gemini wiki adapter path.
WIKI

query_output="${project_dir}/query.out"
lint_output="${project_dir}/lint.out"

PATH="${stub_dir}:/usr/bin:/bin" "${REPO_ROOT}/bin/autoflow" wiki query "$project_dir" .autoflow \
  --term "wiki bot gemini smoke" \
  --synth \
  --runner wiki > "$query_output"
require_line "$query_output" "synth_status=ok"
require_line "$query_output" "synth_runner=wiki"
require_line "${project_dir}/gemini-env.log" "adapter=gemini"
require_line "${project_dir}/gemini-env.log" "autoflow_cli=${REPO_ROOT}/bin/autoflow"
require_line "${project_dir}/gemini-env.log" "autoflow_on_path=true"

PATH="${stub_dir}:/usr/bin:/bin" "${REPO_ROOT}/bin/autoflow" wiki lint "$project_dir" .autoflow \
  --semantic \
  --runner wiki > "$lint_output"
require_line "$lint_output" "semantic_status=ok"
require_line "$lint_output" "semantic_runner=wiki"
require_line "$lint_output" "semantic_finding.none=true"

echo "status=ok"
echo "project_root=$project_dir"
