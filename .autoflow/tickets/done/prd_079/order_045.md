---
id: memo_045
title: 최근 프로젝트 목록에서 사라진 경로 처리 개선
status: inbox
created: 2026-05-01
---

## Request

폴더 선택 버튼 클릭시 목록에 실제 경로가 없어 졌는데도 나와서 선택을 했더니 아무화면도 안나오는 현상이 개선되야함

(맥락: 데스크톱 앱 사이드바/툴바의 프로젝트 폴더 선택 드롭다운에서 "최근 프로젝트" 목록에 이미 디스크에서 삭제/이동된 폴더 경로가 그대로 남아 있고, 그걸 클릭하면 보드 로드가 실패하면서 빈 화면만 보인다는 보고.)

## Notes

- 위치:
  - 저장소: `apps/desktop/src/renderer/main.tsx:238-253` 의 `readRecentProjects` / `persistRecentProjects`. 값은 `localStorage["autoflow.recentProjects"]` 에서 그대로 읽어옴. 디스크 존재 여부 검증 없음.
  - 메뉴 렌더: `apps/desktop/src/renderer/main.tsx:1706-1739` 와 `:2253-2283` (두 군데). `recentProjects.map(...)` 로 그냥 출력.
  - 선택 핸들러: `apps/desktop/src/renderer/main.tsx:1299` 의 `chooseProjectRoot`. 경로 유효성 체크 없이 그대로 `options.projectRoot` 로 세팅.
  - 메인 프로세스 IPC: `apps/desktop/src/main.js` 의 `autoflow:readBoard`. 존재하지 않는 경로면 board snapshot 이 실패/빈 값으로 돌아오는 것으로 보임.
- 의도된 동작 (Plan AI 가 최종 결정):
  1. 메뉴 열 때 또는 앱 시작 시 각 경로의 존재 여부를 확인(IPC 추가 또는 기존 `readBoard` 응답에 `exists` 포함) 해서:
     - 존재하지 않는 경로는 목록에서 자동 제거하거나
     - "(없음)" 같은 disabled 상태로 표시하고 클릭 시 안내.
  2. 선택 직후에도 경로 검증 → 없으면 토스트/에러 배너 표시 + 빈 화면 대신 폴더 선택 안내 화면으로 fallback.
  3. localStorage 정리 로직: 검증 결과 누락된 경로는 `persistRecentProjects` 로 저장 시 제외.
- 추가로 board 가 없거나 경로가 유효하지 않을 때 화면이 비는 케이스 자체도 함께 점검(`boardMissing` 분기와 별개로 "경로 자체가 없음" 분기 필요).

## Scope hint

- 후보 파일:
  - `apps/desktop/src/renderer/main.tsx` (recent projects 관련 영역, `chooseProjectRoot`)
  - `apps/desktop/src/main.js` (필요하면 `path.exists` 체크 IPC 추가)
  - `apps/desktop/src/preload.js` (위 IPC 노출)

## Verification hint

- 로컬에서 임의 폴더 → 프로젝트로 한 번 등록 → 폴더를 다른 위치로 옮기거나 삭제 → 데스크톱 앱 재시작 후 폴더 선택 메뉴를 열어 해당 경로가 더 이상 클릭되지 않거나 자동 제거되는지 확인.
- 그 상태에서 메뉴를 통해 다른 정상 경로로 전환했을 때 화면이 정상적으로 보드/설치 안내로 그려지는지 확인.
- 경로가 정상인 경우의 회귀 (선택 흐름) 가 깨지지 않는지 확인.
