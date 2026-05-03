---
title: 사이드바 "로그" 메뉴 삭제 (essential 화면의 "최근 로그" 섹션은 유지)
created_at: 2026-05-03
source: claude-code /order
---

## Request

로그는 AI 가 검증/트러블슈팅 시 파일 시스템 직접 읽는 용도라 데스크톱 사이드바 메뉴로 노출 안 해도 됨. 검토 결과 삭제 가능하다고 판단되어 사이드바 "로그" 메뉴를 제거해줘. 단, essential 대시보드 영역의 "최근 로그" 섹션은 트러블슈팅용 즉시 노출 경로로 유지.

## 검토 결과 (요약)

**현재 노출 위치:**
- `apps/desktop/src/renderer/main.tsx:214` — 사이드바 settings nav `{ key: "logs", label: "로그", icon: Terminal }`
- `apps/desktop/src/renderer/main.tsx:2033-2083` — `visibleSettingsSection === "logs"` 분기, `LogList` + `LogPreview` 풀화면 (200 한도 + 전체 보기 토글)
- `apps/desktop/src/renderer/main.tsx:2601-2616` — essential 영역의 "최근 로그" 섹션(`LogList` + `LogPreview` 압축형). **유지**.
- `apps/desktop/src/renderer/main.tsx:1093` — 로컬 스토리지 복원 분기 `if (stored === "logs")`

**판단 근거:**
- AI(러너) 는 `.autoflow/logs/` / `.autoflow/runners/logs/*.log` 를 직접 파일 시스템에서 읽음. 데스크톱 UI 메뉴 경유 안 함.
- 사람 트러블슈팅은 essential 화면의 "최근 로그" 섹션으로 충분 (같은 `LogList` + `LogPreview` 컴포넌트). 200건 + 전체 보기 토글이 필요한 경우는 `tail -f` 같은 터미널이 더 효율적.
- 메뉴 항목 5개(AI 진행 현황 / 티켓 / LLM 위키 / 통계 / 로그) 중 하나 줄이면 사이드바 정리 + 인지 부담 감소. 직전 order_084(메뉴 간격) 와도 결이 맞음.

## Scope (hint)

- `apps/desktop/src/renderer/main.tsx`:
  - line 214: `settingsNavigation` 배열에서 `{ key: "logs", label: "로그", icon: Terminal }` 항목 제거.
  - line 1093 (`if (stored === "logs")`): 로컬 스토리지 복원 분기에서 `"logs"` 처리 제거 또는 default(예: `"progress"`) 로 fallback.
  - line 2033-2083: `visibleSettingsSection === "logs"` 분기 블록 전체 제거.
  - 다른 곳에서 `"logs"` SettingsSection key 를 참조하는 곳 (라우팅, breadcrumb, default selection 등) 일괄 정리.
  - `Terminal` 임포트 (line 32 부근) 가 다른 용도(essential 영역의 `Terminal` 아이콘 등) 로 더 이상 안 쓰면 제거. 다른 곳에서 사용 중이면 그대로.
- `apps/desktop/src/renderer/styles.css`:
  - 로그 화면 전용 클래스 (`.log-list-heading`, `.log-heading-copy`, `.log-count-text`, `.log-list-fill`, `.log-list-footer` 등) 가 logs 화면 전용이면 정리. essential 영역에서 같은 클래스 재사용 중이면 유지.
- 변경 안 함:
  - essential 영역 "최근 로그" 섹션 (`.essential-inspector-grid`, `LogList`, `LogPreview` 사용부) — 그대로 유지.
  - `recentLogs` / `LogList` / `LogPreview` 컴포넌트 자체 — essential 에서 계속 사용.
  - `.autoflow/logs/`, `.autoflow/runners/logs/` 파일 시스템 — 영향 없음.

## Allowed Paths (hint)

- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`

## Verification (hint)

- `npm run desktop:check` 통과 (TypeScript 미사용 식별자 / 빌드 에러 없음).
- 데스크톱 미리보기:
  - 사이드바 메뉴가 4개 (AI 진행 현황 / 티켓 / LLM 위키 / 통계) 로 줄어들었는지 확인.
  - essential 화면의 "최근 로그" 섹션은 그대로 보이고 로그 미리보기 정상 동작하는지 확인.
  - 로컬 스토리지에 이전 `"logs"` 값이 저장되어 있던 사용자가 앱 다시 켰을 때 default(예: `"progress"`) 로 안전하게 fallback 되는지.
- `grep -rn "settingsSection.*\"logs\"\|=== \"logs\"\|case \"logs\"" apps/desktop/src/renderer/main.tsx` 결과가 0건인지.
