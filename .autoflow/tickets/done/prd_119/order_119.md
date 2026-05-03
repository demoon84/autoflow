---
title: desktop main process 메모리 천장 도달 시 graceful self-restart (L2 안정화)
created_at: 2026-05-03
source: claude-code /order
---

## Request

데스크톱 dev 앱이 V8 heap OOM(SIGTRAP)으로 5시간 / 4시간 / 11시간 / 2분 연속 강제 종료되는 패턴이 재현됐다 (직전 OOM 패턴은 별건 order/티켓에서 `withTimeout` 누수 hotfix 로 부분 완화). 안정 운영의 1차 방어선으로 **`apps/desktop/src/main.js` 의 메인 프로세스가 자기 메모리 사용량을 주기적으로 점검하고, 임계치 도달 시 OOM 으로 강제 종료되기 전에 `app.relaunch() + app.exit(0)` 으로 graceful self-restart** 하도록 추가한다.

목적은 사용자가 OOM 으로 인한 갑작스러운 화면 꺼짐 / 강제 종료를 거의 못 느끼게 하는 것이다. 누수 자체를 잡는 작업이 아니라, 누수가 있어도 서비스가 멈추지 않게 하는 안전판이다.

## Scope (hint)

- `apps/desktop/src/main.js` 안에서:
  - `app.whenReady()` 직후 (또는 main window 생성 직후) `setInterval` 로 `process.memoryUsage()` (rss / heapUsed) 를 주기 점검 (예: 30초 간격).
  - 임계치(아래 환경변수) 도달 시 다음 순서로 graceful restart:
    1. 진행 중인 IPC / detached runner 가 있으면 정상 정리 (이미 `desktop 앱 종료 시 detached runner 모두 강제 종료` 경로 활용).
    2. `app.relaunch()`
    3. `app.exit(0)`
  - 무한 재시작 폭증 방지를 위해 1회 restart 후 최소 N분(예: 5분) cool-down 동안은 다시 trigger 하지 않음 — 이 cool-down 안에 또 임계치 도달이 잦으면 그건 본질 누수가 심각한 것이므로 별도 모니터(L3) 가 잡도록 둔다.
- 환경변수로 동작 제어 (default 활성, 임계치는 보수적으로):
  - `AUTOFLOW_DESKTOP_MEMORY_CEILING_MB` (default 1500) — 이 RSS 또는 heapUsed 를 넘으면 graceful restart 트리거.
  - `AUTOFLOW_DESKTOP_MEMORY_CHECK_INTERVAL_SECONDS` (default 30).
  - `AUTOFLOW_DESKTOP_MEMORY_CEILING_DISABLED=1` 로 끌 수 있게.
  - `AUTOFLOW_DESKTOP_MEMORY_RESTART_COOLDOWN_SECONDS` (default 300).
- 어느 지표를 임계치로 쓸지는 구현자 판단 (rss 가 OOM 과 더 직접적, heapUsed 가 V8 한계와 더 직접적). 두 지표 중 하나라도 넘으면 트리거하는 안전한 OR 조합도 가능.
- 재시작 직전에 콘솔/로그에 사유와 현재 메모리값을 1줄로 남긴다 (예: `[desktop] memory ceiling reached rss=1612MB heap=1488MB → graceful restart`).
- BrowserWindow 가 자동으로 다시 뜨는 동작은 기존 dev/launch 플로우 그대로 유지.

## Allowed Paths (hint)

- `apps/desktop/src/main.js`

## Verification (hint)

- `npm --prefix apps/desktop run check` 통과.
- 임계치를 일시적으로 낮춰서 (예: `AUTOFLOW_DESKTOP_MEMORY_CEILING_MB=200`) `npm --prefix apps/desktop run dev` 실행 → 30초~수분 안에 graceful restart 가 트리거되고 BrowserWindow 가 자동으로 재기동되는지 확인.
- 콘솔 로그에 메모리값과 restart 사유가 1줄 출력되는지 확인.
- cool-down 동안 즉시 재트리거되지 않는지 확인 (낮은 임계치 + 짧은 cool-down 으로 한 번 더 재현).
- `AUTOFLOW_DESKTOP_MEMORY_CEILING_DISABLED=1` 로 끌 수 있는지 확인.
- 본 변경이 정상 dev 사용 시(메모리 정상 범위) 어떠한 user-visible 동작 변화도 일으키지 않는지 (메모리 점검 setInterval 외 부작용 없음) 확인.

## Notes

- 안정성 3계층 중 L2(사전 재시작)에 해당. L1(watchdog 외부 supervisor) 와 L3(health monitor runner + order 자동 떨구기) 는 별도 후속 order/PRD 로 분리.
- `withTimeout` 누수 hotfix 는 이미 `apps/desktop/src/main.js:2499-2517` 에 적용된 상태이므로 이 order 는 그 hotfix 와 충돌하지 않는 추가 안전판이다.
