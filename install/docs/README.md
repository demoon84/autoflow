# 설치 레벨

이 폴더는 **설치 레벨** 영역이다. `autoflow init` / `autoflow upgrade` 가 대상 프로젝트의 보드 디렉터리로 복사하는 **데이터/구조** source 가 `install/` 아래에 있다. 실행 코드는 여기에 없다 — runner 실행 코드는 [../../app/runtime/](../../app/runtime/) (앱 영역) 에 있고 앱/CLI 가 직접 실행한다.

## 구조

```text
install/
  docs/             설치 레벨 설명 문서
  manifest.toml     설치 매핑 (default board dir, sources)
  board/            보드로 복사되는 프로젝트별 scaffold
    automations/      runner context runtime state
    runners/          local runner 설정과 runtime state
    tickets/          설치 후 실행 원장
    AGENTS.md / README.md
  share/            active core가 직접 제공하는 공통 문서
    agents/           plan-to-ticket, worker, verifier, wiki 등 runner 계약
    reference/        automations, runner-startup, runner-tool-contract, runner 기본 topology 등
    rules/            verifier/wiki 운영 규칙
    protocols/        worker-contract, board-orchestration
    state-schema/     sqlite schema
  host/             설치 대상 프로젝트 루트에 놓이는 host 가이드
    AGENTS.md
    CLAUDE.md
  integrations/     Claude/Codex 호스트 통합
    claude/skills/    전역 /autoflow skill source
    claude/plugin/    프로젝트별 Claude Code stop hook plugin
    codex/skills/     전역 codex skill + agents/openai.yaml source
```

## 문서 인덱스

| 문서/영역 | 내용 | 위치 |
|---|---|---|
| [README.md](README.md) | 설치 레벨 구조와 manifest 계약 | `install/docs/` |
| [../board/](../board/) | 설치 보드에 복사되는 프로젝트별 보드 scaffold와 runtime state 폴더 | 설치 산출물 source 라서 원위치 유지 |
| [../share/](../share/) | 모든 프로젝트가 공유하는 runner 계약, reference, rules, protocols, schema | active core share source |
| [../host/](../host/) | 설치 대상 프로젝트 루트에 놓이는 host `AGENTS.md` / `CLAUDE.md` 템플릿 | 설치 산출물 source 라서 원위치 유지 |
| [../integrations/](../integrations/) | Codex/Claude `autoflow` skill 및 plugin 템플릿 | 설치 산출물 source 라서 원위치 유지 |

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
target = "{{CLAUDE_HOME}}/skills"
type = "user_home"
overwrite = "upgrade"
template = true

[sources.claude_plugin]
path = "install/integrations/claude/plugin"
target = ".claude/autoflow-plugin"
type = "host"
overwrite = "upgrade"
template = true

[sources.codex_skills]
path = "install/integrations/codex/skills"
target = "{{CODEX_HOME}}/skills"
type = "user_home"
overwrite = "upgrade"
template = true

# runtime_scripts 는 여기 없다. 실행 코드는 app/runtime/ 에 있고 보드에 복사되지 않는다.
```

새 install source 를 추가할 때는 이 manifest 에 source id 를 추가한다. 코드 쪽에는 install source 경로 목록을 다시 하드코딩하지 않는다.

설치 보드 디렉터리 이름(`default_board_dir`) 은 **설정값**이지 source 폴더 이름이 아니다. 보드 이름을 바꾸고 싶어도 `install/` 안 폴더는 그대로 둔다.

## 보드는 데이터, 공통 문서는 share, 실행은 앱

보드는 데이터만 갖는다(`tickets/`, `runners/config.local.toml`, `runners/state/`, `automations/state/`, `metrics/`, `conversations/`, `wiki/`, `raw/`, `manifest.toml`). 보드는 개인 로컬 실행 원장이며 기본적으로 Git 추적 대상이 아니다. 위키 원본은 로컬 markdown이고 qmd cache/index/DB는 선택 검색 가속기다. 공통 문서, role prompt, automation rule, 기본 runner topology, Goal Acceptance Gate 계약은 보드마다 복제하지 않고 active core의 `install/share/`를 직접 참조한다. `AUTOFLOW_SHARE_ROOT`를 지정한 경우에만 별도 share root를 쓴다. 보드 안에는 더 이상 `scripts/`, `agents/`, `reference/`, `rules/`, `protocols/`, `state-schema/`, `logs/` 폴더가 만들어지지 않는다. runner 실행은 resolved Autoflow core의 [../../app/runtime/](../../app/runtime/) 코드가 한다. 호출 시 `BOARD_ROOT`/`PROJECT_ROOT` 환경변수로 대상 보드를 알려준다. 결과:

- autoflow 한 곳을 업데이트하면 모든 보드에 즉시 반영
- 보드마다 공통 문서 파일 중복 없음
- 보드는 `manifest.toml`과 전역 registry를 통해 core/share 위치를 확인
- `autoflow upgrade` 는 옛 보드의 stale `<board>/scripts/`, `<board>/agents/`, `<board>/reference/`, `<board>/rules/`, `<board>/protocols/`, `<board>/state-schema/` 폴더를 자동 제거

## 보드 Manifest와 Core Resolver

`autoflow init|upgrade`는 대상 보드에 `.autoflow/manifest.toml`을 생성하거나 갱신한다. 이 파일은 프로젝트 데이터 schema와 전역 core 참조를 기록한다.

```toml
[board]
schema_version = "1"
project_root = "<project-root>"
board_root = "<project-root>/.autoflow"

[core]
ref = "global"
required_core_version = "0.1.0"
last_resolved_root = "<autoflow-core-root>"
runtime_root = "<autoflow-core-root>/app/runtime"
share_root = "<autoflow-core-root>/install/share"
pinned_core_root = ""
pinned_core_version = ""
```

Core resolver 우선순위는 다음과 같다.

1. `AUTOFLOW_CORE_ROOT`
2. 보드 manifest의 `pinned_core_root`
3. `~/.autoflow/core-registry.json`의 active core
4. 현재 실행 중인 Autoflow 앱/CLI root
5. 보드 manifest의 `last_resolved_root` fallback

개발환경에서는 다음 명령으로 현재 repo를 active core로 등록한다.

```bash
./app/bin/autoflow dev-link
```

이후 설치된 보드는 공통 파일을 다시 복사하지 않고 active core의 runtime/share를 참조한다. 패키징 앱에서는 앱/CLI root가 current core가 되며, 앱 업데이트가 곧 core 업데이트가 된다. `upgrade`는 공통 파일 덮어쓰기보다 schema migration, 누락 scaffold 생성, host guidance refresh에 집중한다.

## Template Token

install source 텍스트가 보드 디렉터리나 user home 경로를 참조해야 하면 직접 박지 않고 `{{BOARD_DIR}}`, `{{SHARE_ROOT}}`, `{{CORE_ROOT}}`, `{{RUNTIME_ROOT}}`, `{{INSTALL_ROOT}}`, `{{CODEX_HOME}}`, `{{CLAUDE_HOME}}`, `{{USER_HOME}}` 토큰을 쓴다. [manifest.toml](../manifest.toml) 에서 `template = true` 인 source 는 설치 시 해당 값으로 치환된다. `{{BOARD_DIR}}` 기본값은 `.autoflow`, `{{CODEX_HOME}}` 기본값은 `~/.codex`, `{{CLAUDE_HOME}}` 기본값은 `~/.claude` 다. `template = false` 인 board source 는 자동화 템플릿처럼 런타임에 다시 처리할 토큰을 그대로 보존한다.

## 어디서 호출되나

- `app/bin/autoflow init|upgrade` → [app/cli/system/install-board.ts](../../app/cli/system/install-board.ts) 가 [manifest.toml](../manifest.toml) 의 source map 을 읽어 `install/board/`, `install/host/`, `install/integrations/` 를 대상 보드, user home skill root, host 로 복사한다. `install/share/`는 기본적으로 active core 안에서 직접 참조되며, `AUTOFLOW_SHARE_ROOT`를 별도로 지정한 경우에만 해당 share root로 동기화한다. 대상 프로젝트의 기존 `AGENTS.md` / `CLAUDE.md` 는 기본적으로 보존하며, 명시 옵션 `--refresh-host-guidance` 를 주면 현재 host 템플릿으로 갱신한다.
- runner 실행은 [../../app/runtime/](../../app/runtime/) 의 코드가 직접 처리. 보드는 호출 대상이 아니라 입력 데이터 (env var 로 전달).
