# Autoflow Memo

## Memo

- ID: memo_034
- Title: 로딩 중 전체 페이지 덮는 로딩 오버레이 복원
- Status: inbox
- Created At: 2026-04-30T00:00:00Z
- Source: claude /order

## Request

로딩중일때 페이지에 전체를 덮는 로딩이 적용 되었었는데  없어진거 같아 이전 작업 내역을 찾아보고 있다면 그대로 적용

## Hints

### Scope

- 데스크톱 렌더러(`apps/desktop/src/renderer/main.tsx`)에서 보드/페이지 전환 또는 초기 부트 시 전체 화면을 덮는 로딩 오버레이가 보이지 않는다는 사용자 보고. 현재 `isBoardLoading` state(`main.tsx:871`)는 사이드바 버튼 아이콘 swap(`main.tsx:1535`, `Loader2` ↔ `FolderOpen`)에만 쓰이고, 전역 backdrop 형태의 풀페이지 로더는 코드에 남아 있지 않다.
- 우선순위: (1) `git log` 와 reflog 에서 풀페이지 로더 관련 커밋/PR/PRD(예: 데스크톱 디자인 키트 MUI 마이그레이션 73b3b1c, 좌측 메뉴/레이어 관련 커밋 15bb80d, 9c65461 등) 로 회귀 시점을 찾는다. (2) 이전 구현이 발견되면 그 구조 그대로 복원하되, 현 토픽 정책(MUI 우선, AGENTS.md §17) 에 맞게 `Backdrop` + `CircularProgress` 또는 동등 컴포넌트로 wrap. (3) 회귀 시점을 못 찾으면 가장 좁은 범위의 신규 구현으로 부트/보드 변경/Statistics·Wiki·Tickets 페이지 전환 동안 표시되는 풀페이지 backdrop 을 추가하고, 트리거 신호는 기존 `isBoardLoading`, `isReadingLog`, `isInstalling` 등 이미 선언된 loading flag 들을 재사용한다.

### Allowed Paths

- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`
- `apps/desktop/src/components/ui/`

### Verification

- Command: `npm --prefix apps/desktop run check`
- Manual: desktop dev 모드에서 (a) 앱 부트 직후, (b) 프로젝트 루트 변경/보드 새로고침, (c) 큰 로그/위키 미리보기 로딩 시 풀페이지 backdrop 이 즉시 떴다가 로딩 종료와 함께 사라지는지 확인. 백드롭이 클릭/스크롤을 잠그는지, ESC/포커스 핸들링이 다른 레이어와 충돌하지 않는지도 함께 본다.

## Planner Contract

- Plan AI treats this memo as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn memo intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
