# Autoflow Memo

## Memo

- ID: memo_060
- Title: Codex 사용 시 fast 모드 적용
- Status: inbox
- Created At: 2026-05-01T22:20:44Z
- Source: autoflow memo create

## Request

코덱스를 사용할때 fast모드로 사용할것

요청 의미:
- Autoflow에서 Codex runner/adapter를 사용할 때 기본 실행 모드 또는 reasoning preset을 fast로 맞춘다.
- 현재 owner-1은 agent=codex, model=gpt-5.3-codex-spark, reasoning=medium 이므로 Codex 사용 경로의 기본값/설정/UI 표시를 점검한다.
- 저장된 runner 설정, CLI 호출 preview, 데스크톱 runner 설정 UI가 서로 다른 값을 보여주지 않게 한다.

## Hints

### Scope

- Codex agent를 쓰는 Autoflow runner가 fast 모드로 실행되도록 runner config 기본값, Codex CLI adapter의 reasoning 전달, 데스크톱 runner 설정 UI/옵션을 검토해 필요한 최소 변경을 한다. fast가 내부적으로 literal value인지 낮은 reasoning effort인지 repo의 기존 runner option 체계에 맞춰 결정한다.

### Allowed Paths

- `.autoflow/runners/config.toml`
- `scaffold/board/runners/config.toml`
- `packages/cli/runners-project.sh`
- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`

### Verification

- Command: ./bin/autoflow runners list /Users/demoon2016/Documents/project/autoflow .autoflow && cd apps/desktop && npx tsc --noEmit && node scripts/check-syntax.mjs

## Planner Contract

- Plan AI treats this memo as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn memo intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
