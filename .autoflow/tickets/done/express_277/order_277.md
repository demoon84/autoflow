# Autoflow Order

## Order

- Title: doctor 의 stale watcher_pid 경고 폐기 — PTY mode 에선 board-watcher daemon 자체가 없음
- Express: true
- Priority: low
- Status: ready
- Change Type: code

## Request

`autoflow doctor` 가 `check.watcher_pid=warning` + `watcher.status=stale_pid` 로 띄움. 원인: 옛 loop mode 에서 별도 board-watcher daemon (`watch-board.sh`) 가 돌 때 쓰던 PID 체크가 그대로 남음. 현재 PTY mode 에서는 board watch 가 `apps/desktop/src/main.js` 의 `ensureBoardWatcher` (Electron 내 fs.watch) 안에서 동작하므로 별도 daemon 자체가 존재 안 함. stale_pid 알람은 의미 없음.

## Allowed Paths

- packages/cli/doctor-project.sh
- runtime/board-scripts/doctor-project.sh

## Done When

- [ ] `packages/cli/doctor-project.sh` 의 watcher_pid 체크를 다음 중 하나로 변경:
  - 옵션 A: 검사 자체 제거
  - 옵션 B: `.autoflow/runners/state/watcher.pid` 가 없으면 silent ok (PTY mode 에선 정상), 있을 때만 stale 검사
  - 옵션 C: env `AUTOFLOW_HAS_LEGACY_WATCHER=1` 일 때만 검사 실행 (default off)
- [ ] `runtime/board-scripts/` 미러 동기화
- [ ] `bash packages/cli/doctor-project.sh <root> .autoflow | grep watcher_pid` 가 ok 또는 미출력

## Verification

- Command: bash packages/cli/doctor-project.sh /Users/demoon2016/Documents/project/autoflow .autoflow | grep -E "watcher"

## Notes

- Express rationale: shell 1~3줄 수정 + 미러 1회. PRD 불필요.
- 옵션 B 가 호환성에 가장 안전.
