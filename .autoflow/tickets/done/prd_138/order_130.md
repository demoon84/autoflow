---
title: 데스크톱 앱 아이콘 표시 점검 — dock 아이콘 dev 모드 검증 + UI 사이드바 brand 마크 추가
created_at: 2026-05-03
source: claude-code /order
---

## Request

데스크톱 앱 아이콘이 있었는데 사라진 것 같음. 확인해서 (1) macOS dock 아이콘이 정상 표시되는지 검증하고, (2) 사이드바 또는 상단바에 Autoflow brand 마크(앱 아이콘) 자리가 보이도록 복원/추가해줘.

## 검토 결과

| 영역 | 상태 |
|---|---|
| macOS dock 아이콘 setup | 코드상 정상: `apps/desktop/src/main.js:3053-3057` 의 `app.whenReady()` 안에서 `app.dock.setIcon(nativeImage.createFromPath(appIconPath))` 호출. |
| 아이콘 자산 | `apps/desktop/src/renderer/assets/app/app-icon.png` (148KB), `app-icon.svg` (2.4KB) 존재. `apps/desktop/build/app-icon.icns`, `apps/desktop/build/app-icon.png` 도 존재. |
| favicon (renderer dev tools 탭) | `apps/desktop/src/renderer/index.html:6` 에서 `app-icon.svg` 정상 link. |
| **renderer UI 안 brand/logo 표시 컴포넌트** | **없음** — `settings-nav` 사이드바, `essential-topbar` 상단바, `window-drag-region` 어디에도 brand 마크 표시 자리 없음. `app-icon` 키워드는 모두 agent별 아이콘(`AgentAppIcon`) 용도. |
| 최근 brand 관련 commit | `8ddafa6 Add Autoflow wave app icon`, `c0fa11d Adjust app icon padding` 만 존재. UI 표시 추가 commit 흔적 없음. |

## 추정 원인

- **(가설 1)** dev 모드(`npm run desktop:dev` / `electron .`) 에서 macOS dock 이 generic Electron 아이콘으로 표시 — `app.dock.setIcon` 호출은 정상이지만 timing 또는 캐시 영향. production build 에서는 `.icns` 가 적용됨. 사용자가 production 처럼 보이던 dock 아이콘이 dev 실행 시 generic 으로 바뀌어 "사라진 것처럼" 보일 수 있음.
- **(가설 2)** 사용자가 사이드바 또는 상단바 안에 brand 마크가 있던 모습을 기대했으나 실제로는 UI 안에 그 자리가 한 번도 없었음 (시각적 기억 또는 다른 화면과 혼동).
- **(가설 3)** 최근 어떤 직접 변경에서 사이드바 brand 컴포넌트가 제거된 후 git history 에 잘 안 잡힘 (rename / single-file modify 등으로 추적 어려움).

## Scope (hint) — 두 갈래로 정리

### A. dock 아이콘 dev 모드 표시 검증/보강
- `apps/desktop/src/main.js`:
  - `app.whenReady()` 안 `app.dock.setIcon` 호출이 dev 모드에서 실제 적용되는지 디버그 로그(`appIcon.isEmpty()` 결과, `appIconPath` 값) 1회 출력 후 확인.
  - 필요 시 호출 timing 조정 (`app.whenReady` → `app.on('ready')` 변경, 또는 BrowserWindow 생성 직후 추가 호출).
  - production build 에서 `.icns` 가 macOS bundle 의 `Contents/Resources/electron.icns` 를 덮어쓰도록 build/packaging 설정 점검 (electron-builder / electron-forge 가 도입돼 있다면 `build.mac.icon` 필드 확인).
- 아이콘 자산 정합:
  - `apps/desktop/build/app-icon.png` (1024x1024) 가 `apps/desktop/src/renderer/assets/app/app-icon.png` 와 동일 byte 인지 확인 (현재 둘 다 148876 bytes 로 일치).

### B. UI 안 brand 마크 추가 (사이드바 또는 상단바)
- 사이드바 위치 추가 후보:
  - `apps/desktop/src/renderer/main.tsx` 의 `settings-nav` 영역 (line 1840 부근) `nav` 위에 brand row 추가 (`app-icon.svg` 사용). 메뉴 nav-item 과 시각적으로 분리되도록 padding/border-bottom.
  - 클릭 시 default section(예: `progress`) 으로 이동하거나 단순 표시 only.
- 상단바 위치 후보:
  - `essential-topbar` (line 2415) 의 leading 자리에 brand mark + "Autoflow" 텍스트 (또는 작은 마크만).
- 자산 사용:
  - SVG 권장 (`./assets/app/app-icon.svg`), 가벼움 + 다크/라이트 테마 호환. 필요 시 PNG fallback.
  - `aria-label="Autoflow"` / `alt="Autoflow"` 명시.

권장: **둘 다 진행**. (A) 는 macOS 표시 검증, (B) 는 UI 안에서 즉시 보이는 brand 자리 추가.

## Allowed Paths (hint)

- `apps/desktop/src/main.js` (dock 아이콘 setup 디버그 + timing 보강)
- `apps/desktop/src/renderer/main.tsx` (사이드바 또는 상단바 brand 추가)
- `apps/desktop/src/renderer/styles.css` (brand 표시 관련 클래스 추가)
- `apps/desktop/src/renderer/index.html` (필요 시 favicon link 정합 점검)
- `apps/desktop/package.json` 또는 build config (electron-builder/forge 설정이 있으면) — 단 본 order 범위에서는 read-only 확인 후 별도 PRD 분리 권장

## Verification (hint)

- `npm run desktop:check` 통과 (TypeScript/빌드 에러 없음).
- 데스크톱 미리보기:
  - macOS dock 에 Autoflow wave 아이콘이 표시되는지 (dev 모드 기준).
  - 사이드바 또는 상단바에 brand 마크 + "Autoflow" 라벨이 노출되는지.
  - 다크/라이트 테마 모두에서 brand 마크가 잘리거나 색이 깨지지 않는지.
  - 좁은 viewport 에서도 brand 영역이 layout 을 깨지 않는지.
- (선택) production build (`electron-builder` / `electron .`) 빌드 결과의 `Contents/Resources/` 안 `.icns` 가 Autoflow wave 아이콘인지 확인.

## Notes

- **연관 직전 변경:** order_080 (테마 토글 사이드바 footer 이동) 작업 후 사이드바 footer 재배치가 있었음. 이때 brand 마크가 footer 또는 nav 위쪽에 함께 있던 시점이 있다면 함께 제거됐을 가능성 — 머지된 commit 들을 한번 더 시각적으로 비교하면 도움.
- **위험:** dock 아이콘 timing 변경은 다른 OS 동작에 영향 없음 (macOS 전용 분기). renderer UI 추가는 layout shift 만 주의.
- **검증 후 cleanup:** 디버그 로그(`console.log(appIconPath, !appIcon.isEmpty())`) 는 검증 후 제거.
