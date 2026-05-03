# Autoflow Order

## Order

- ID: order_145
- Title: 프로젝트 루트에 quote-prefix 빈 shadow 디렉토리 7개 (install/scaffold quote 버그)
- Status: inbox
- Priority: normal
- Created At: 2026-05-03T12:44:13Z
- Source: autoflow order create

## Request


프로젝트 루트에 `"` 접두사로 시작하는 garbage 디렉토리 7개가 5/3 08:18 일괄 생성됨. 사용자 IDE/파일 트리에 노출되어 혼란 유발.

```
".claude/      ← .claude 의 shadow
".codex/       ← .codex 의 shadow
"apps/         ← apps 의 shadow
"bin/          ← bin 의 shadow (비어있음)
"integrations/ ← integrations 의 shadow
"packages/     ← packages 의 shadow
"scaffold/     ← scaffold 의 shadow
```

각각 정상 디렉토리의 source 트리만 mirror (build/dist/node_modules 같은 generated 는 없음). 이후 변동 0. 즉 빈 shadow.

생성 timestamp 모두 `May 3 08:18` 동시 → install/scaffold/setup 스크립트의 **string interpolation quote escape 버그**. 직접 install-stop-hook.sh / scaffold/ 검사로는 origin 파악 못함 (의심: order/template 처리 시점에 path 인자 escape 누락).

## Symptoms

- IDE 의 파일 트리에 정상 디렉토리와 함께 quoted shadow 7개 표시
- git tracked 가 아니므로 commit 에는 안 들어가지만 사용자 워크스페이스 오염
- shell 에서 `ls` 시에도 노이즈

## Suggested Fix

A) **즉시 정리** (사용자 환경):
```bash
cd /Users/demoon2016/Documents/project/autoflow
rm -rf '".claude' '".codex' '"apps' '"bin' '"integrations' '"packages' '"scaffold'
ls | grep '^"' | wc -l   # 0 이어야 함
```

B) **재발 방지**:
- install / scaffold / setup 스크립트의 path 인자 처리에서 `printf %q` 또는 `"$path"` 일관 사용
- mkdir / cp 의 인자가 `"path"` 형태로 들어오는 경우 (이미 quoted) 추가 escape 안 하게
- 의심 파일:
  - `packages/cli/install-stop-hook.sh`
  - `.autoflow/scripts/install-stop-hook.sh`
  - `runtime/board-scripts/install-stop-hook.sh`
  - 또는 setup-cowork / autoflow init 류

C) **CI 가드**:
- 스크립트 종료 시 `find . -maxdepth 1 -name '"*'` 검사 → 매치 시 fail

## Allowed Paths

- packages/cli/install-stop-hook.sh
- .autoflow/scripts/install-stop-hook.sh
- runtime/board-scripts/install-stop-hook.sh
- 또는 origin 으로 식별된 다른 setup 스크립트
- 정리 자체는 사용자가 직접 (root 영역 삭제이므로 신중)

## Verification

```bash
# 정리 후
find /Users/demoon2016/Documents/project/autoflow -maxdepth 2 -name '"*' | wc -l
# 0 이어야 함
# 재발 테스트: 의심 install/setup 스크립트 dry-run
```

## Notes

- 사용자가 IDE 에서 직접 본 사례. 1원칙 가시성/무결성 표면.
- shadow 트리 안에 build/dist 가 없으므로 빌드 산출물 오염은 아님 — 즉시 삭제 안전.
- 최초 발견 시점 5/3 08:18 ≈ 사용자가 본 모니터링 task 시작 직전 = 그 무렵의 install/init 명령이 강한 후보.

## Hints

### Scope

- pending Plan AI inference

### Allowed Paths

- `packages/cli/install-stop-hook.sh`
- `.autoflow/scripts/install-stop-hook.sh`

### Verification

- Command: find . -maxdepth 2 -name '"*' | wc -l

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
