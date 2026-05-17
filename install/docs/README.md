# Install Level

이 폴더는 **설치 레벨** 영역이다. `autoflow init` / `autoflow upgrade` 가 대상 프로젝트의 보드 디렉터리로 복사하는 **데이터/구조** source 가 `install/` 아래에 있다. 실행 코드는 여기에 없다 — runner 실행 코드는 [../../app/runtime/](../../app/runtime/) (앱 영역) 에 있고 앱/CLI 가 직접 실행한다.

## 구조

```text
install/
  docs/             설치 레벨 설명 문서
  manifest.toml     설치 매핑 (default board dir, sources)
  board/            보드로 복사되는 문서, 규칙, 템플릿
    agents/           plan-to-ticket, worker, verifier, wiki 등 runner 계약
    automations/      stop hook, realtime wake, runner context 계약
    reference/        runner-startup, runner-tool-contract 등
    rules/            wiki 린트 등 보드 운영 규칙
    protocols/        worker-contract, recovery, board-orchestration
    runners/          runner config 템플릿
    AGENTS.md / README.md
  host/             설치 대상 프로젝트 루트에 놓이는 host 가이드
    AGENTS.md
    CLAUDE.md
  integrations/     Claude/Codex/Gemini 호스트 통합
    claude/skills/    /autoflow, /order skill
    claude/plugin/    autoflow-plugin
    codex/skills/     codex 동등 skill + agents/openai.yaml
    gemini/skills/    Gemini workspace skill
```

## 문서 인덱스

| 문서/영역 | 내용 | 위치 |
|---|---|---|
| [README.md](README.md) | 설치 레벨 구조와 manifest 계약 | `install/docs/` |
| [../board/](../board/) | 설치 보드에 복사되는 runner 계약, reference, rules, wiki 템플릿 | 설치 산출물 source 라서 원위치 유지 |
| [../host/](../host/) | 설치 대상 프로젝트 루트에 놓이는 host `AGENTS.md` / `CLAUDE.md` 템플릿 | 설치 산출물 source 라서 원위치 유지 |
| [../integrations/](../integrations/) | Codex/Claude/Gemini skill 및 plugin 템플릿 | 설치 산출물 source 라서 원위치 유지 |

## 설치 매핑

[install/manifest.toml](../manifest.toml) 의 `[sources.<id>]` 가 설치 source 와 대상 경로를 명시한다. `autoflow init|upgrade` 와 데스크톱 host skill 보정은 이 manifest 를 읽어 복사 대상을 결정한다:

```toml
[install]
default_board_dir = ".autoflow"

[sources.board]
path = "install/board"
target = "{{BOARD_ROOT}}"
type = "board"
overwrite = "upgrade"
template = false
skip_shell = true

[sources.host]
path = "install/host/AGENTS.md"
target = "AGENTS.md"
type = "host"
overwrite = "never"
template = true

[sources.host_claude]
path = "install/host/CLAUDE.md"
target = "CLAUDE.md"
type = "host"
overwrite = "never"
template = true

[sources.claude_skills]
path = "install/integrations/claude/skills"
target = ".claude/skills"
type = "host"
overwrite = "upgrade"
template = true

[sources.claude_plugin]
path = "install/integrations/claude/plugin"
target = ".claude/autoflow-plugin"
type = "host"
overwrite = "upgrade"
template = true

[sources.claude_plugin_skills]
path = "install/integrations/claude/skills"
target = ".claude/autoflow-plugin/skills"
type = "host"
overwrite = "upgrade"
template = true

[sources.codex_skills]
path = "install/integrations/codex/skills"
target = ".codex/skills"
type = "host"
overwrite = "upgrade"
template = true

[sources.gemini_skills]
path = "install/integrations/gemini/skills"
target = ".gemini/skills"
type = "host"
overwrite = "upgrade"
template = true
# runtime_scripts 는 여기 없다. 실행 코드는 app/runtime/ 에 있고 보드에 복사되지 않는다.
```

새 install source 를 추가할 때는 이 manifest 에 source id 를 추가한다. 코드 쪽에는 install source 경로 목록을 다시 하드코딩하지 않는다.

설치 보드 디렉터리 이름(`default_board_dir`) 은 **설정값**이지 source 폴더 이름이 아니다. 보드 이름을 바꾸고 싶어도 `install/` 안 폴더는 그대로 둔다.

## 보드는 데이터, 실행은 앱

보드는 데이터만 갖는다 (`tickets/`, `logs/`, `state/`, `wiki/`). 보드 안에는 더 이상 `scripts/` 폴더가 만들어지지 않는다. runner 실행은 항상 autoflow 저장소의 [../../app/runtime/](../../app/runtime/) 코드가 한다. 호출 시 `BOARD_ROOT`/`PROJECT_ROOT` 환경변수로 대상 보드를 알려준다. 결과:

- autoflow 한 곳을 업데이트하면 모든 보드에 즉시 반영
- 보드마다 159개 파일 중복 없음
- 보드는 autoflow 저장소가 있어야 동작 (어차피 사용자도 `git clone <this-repo>` 가 전제라 무관)
- `autoflow upgrade` 는 옛 보드의 stale `<board>/scripts/` 폴더를 자동 제거

## Template Tokens

install source 텍스트가 보드 디렉터리를 참조해야 하면 직접 박지 않고 `{{BOARD_DIR}}` 토큰을 쓴다. [manifest.toml](../manifest.toml) 에서 `template = true` 인 source 는 설치 시 `default_board_dir` 값으로 치환된다 (기본 `.autoflow`). `template = false` 인 board source 는 자동화 템플릿처럼 런타임에 다시 처리할 토큰을 그대로 보존한다.

## 어디서 호출되나

- `app/bin/autoflow init|upgrade` → [app/cli/system/install-board.ts](../../app/cli/system/install-board.ts) 가 [manifest.toml](../manifest.toml) 의 source map 을 읽어 `install/board/`, `install/host/`, `install/integrations/` 를 대상 보드와 host 로 복사. 옛 `<board>/scripts/` 가 있으면 제거. 대상 프로젝트의 기존 `AGENTS.md` / `CLAUDE.md` 는 기본적으로 보존하며, 명시 옵션 `--refresh-host-guidance` 를 주면 현재 host 템플릿으로 갱신한다.
- runner 실행은 [../../app/runtime/](../../app/runtime/) 의 코드가 직접 처리. 보드는 호출 대상이 아니라 입력 데이터 (env var 로 전달).
