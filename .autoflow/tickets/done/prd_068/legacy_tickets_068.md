# Ticket

## Ticket

- ID: legacy_Todo-068
- PRD Key: prd_068
- Plan Candidate: 데스크톱 사이드바 첫 자리 대화 메뉴 + 단일 영속 스레드 + memo/PRD 저장 + 보드/Wiki 컨텍스트 자동 주입
- Title: 데스크톱 대화 메뉴로 memo·PRD 작성하기
- Stage: done
- AI: ticket-owner
- Claimed By: claude-opus-4-7@desktop
- Execution AI: claude
- Verifier AI: claude
- Last Updated: 2026-04-30T00:00:00Z

## Goal

- Autoflow Desktop 사이드바 첫 자리에 "대화" 메뉴를 추가하고, 앱 진입 기본 화면을 그 화면으로 만든다. 프로젝트당 하나의 영속 대화 스레드를 이어가며, 같은 화면에서 memo 또는 PRD 산출물을 저장한다. 매 어댑터 호출에 보드 스냅샷과 wiki answer 발췌를 자동 주입해 컨텍스트 손실을 방지한다.

## References

- PRD: tickets/backlog/prd_068.md
- Feature PRD:
- Plan:

## Obsidian Links

- Project Note: [[prd_068]]
- Plan Note:
- Ticket Note: [[legacy_Todo-068]]

## Allowed Paths

- `apps/desktop/src/main.js`
- `apps/desktop/src/preload.js`
- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`
- `apps/desktop/src/renderer/theme.ts`
- `apps/desktop/src/components/ui/**`
- `apps/desktop/src/lib/**`
- `runtime/board-scripts/chat-once.sh`
- `runtime/board-scripts/chat-prompts/**`
- `runtime/board-scripts/run-role.sh`
- `scaffold/board/scripts/chat-once.sh`
- `scaffold/board/scripts/chat-prompts/**`
- `tests/smoke/desktop-chat-spec-intake-smoke.sh`

## Worktree

- Branch: (none — PROJECT_ROOT direct work)
- Path: /Users/demoon2016/Documents/project/autoflow
- Base: main
- Created At: 2026-04-30T00:00:00Z

## Done When

- [ ] 사이드바 첫 자리에 "대화" 메뉴가 보이고, 작업/Tickets/Wiki/통계/로그가 같은 순서로 그 뒤에 이어진다.
- [ ] localStorage 비어 있을 때 또는 알 수 없는 키일 때 첫 화면이 대화 페이지다.
- [ ] 채팅 IPC(chatLoad/Append/Send/Summarize/Reset/saveMemo/saveSpec) + chat-once.sh + chat-prompts 텍스트가 모두 추가된다.
- [ ] 보드 스냅샷(wiki index/overview/log/answers 카탈로그/보조 디렉토리/done 10/inprogress/inbox/backlog/saved_paths)이 IPC 가 빌드한 system 프롬프트에 매번 포함된다.
- [ ] 사용자 메시지 키워드와 매칭되는 wiki answer 본문이 상위 K(기본 3)개 첨부되며 토글 OFF 시 카탈로그만 남는다.
- [ ] memo/PRD 저장 IPC 가 절대경로 prefix 를 검증하고 다음 NNN 번호를 계산한다.
- [ ] 단일 스레드 파일 `.autoflow/conversations/desktop-chat.md` + frontmatter 필드 + 아카이브 디렉토리가 의도대로 동작한다.
- [ ] `npm --prefix apps/desktop run check` 가 통과한다.
- [ ] `bash tests/smoke/desktop-chat-spec-intake-smoke.sh` 가 통과한다.

## Next Action

- chat-prompts 텍스트 파일을 작성하고 chat-once.sh 진입점을 만든 뒤 main.js IPC 와 renderer UI 를 차례로 구현한다.

## Resume Context

- Current state: PRD 와 ticket 이 만들어졌고 mini-plan 단계까지 도달했다.
- Last completed action: PRD prd_068 저장, ticket inprogress 등록, wiki query 로 관련 컨텍스트 확인.
- First thing to inspect on resume: `apps/desktop/src/main.js` 의 IPC 핸들러 등록부와 `apps/desktop/src/renderer/main.tsx` 의 `settingsNavigation` 정의 부근.

## Notes

- Mini-plan:
  1. **chat-prompts 텍스트** (`runtime/board-scripts/chat-prompts/`): `chat-base.txt`, `spec-author.txt`, `order-intake.txt`, `board-snapshot.tpl.txt`, `wiki-answers.tpl.txt` 5개 파일. system 프롬프트의 각 영역 템플릿. 한국어 응답·출처 표기·보드 read-only 안내 포함.
  2. **chat-once.sh** (`runtime/board-scripts/chat-once.sh`): `run-role.sh` 의 `prepare_adapter_cli_env` / `run_default_adapter_command` 를 source 하지 않고 동일 패턴으로 작성. stdin 으로 system+user 합본 프롬프트를 받아 단발 호출 후 stdout 로 응답 반환. CLI 미구성 시 명확한 한국어 오류.
  3. **main.js IPC**:
     - `autoflow:chatLoad({projectRoot, boardDirName})`: `desktop-chat.md` 읽고 frontmatter+messages 구조화. 파일 없으면 빈 스레드. 보드 스냅샷·wiki answer 카탈로그를 함께 빌드해 반환.
     - `autoflow:chatAppend({projectRoot, boardDirName, message})`: 메시지 한 건 append + frontmatter `last_active_at` 갱신.
     - `autoflow:chatSend({projectRoot, boardDirName, mode, wikiCite, summaryHandover})`: 컨텍스트 윈도우 + 스냅샷 + 매칭된 wiki answer 본문을 합쳐 chat-once.sh 호출. 응답 텍스트와 attached wiki paths 반환. invocation id 등록(취소 가능).
     - `autoflow:chatSummarize`: 메시지 50개 초과 시 요약 호출 + frontmatter `summary` 갱신.
     - `autoflow:chatReset`: 현재 스레드 → archive/<ts>.md 이동 + 새 빈 스레드 frontmatter `prior_summary`/`prior_archive_path` 채움.
     - `autoflow:saveMemo({projectRoot, boardDirName, title, body})`: `tickets/inbox/memo_NNN.md` 작성. NNN 다음 번호 계산. saved_paths 갱신.
     - `autoflow:saveSpec({projectRoot, boardDirName, title, body})`: `tickets/backlog/prd_NNN.md` 작성. NNN 다음 번호. saved_paths 갱신.
     - 절대경로 prefix 검증: `assertInsideBoardSubdir(absPath, allowedPrefix)`.
  4. **preload.js**: 위 IPC 7종 노출.
  5. **renderer/main.tsx**:
     - `settingsNavigation` 첫 자리에 `{ key: "chat", label: "대화", icon: MessageSquare }` 추가.
     - `activeSettingsSection` 초기값 fallback 을 `"chat"` 으로 변경(저장값 없거나 알 수 없을 때).
     - 새 섹션 분기 `activeSettingsSection === "chat"` → `<ChatView />`.
     - `ChatView` 컴포넌트: 헤더(현재 프로젝트 + 모드 토글 ToggleButtonGroup + Wiki 인용 Switch + 이전 요약 인계 Switch + 초기화 IconButton) + 메시지 리스트(role=log, aria-live=polite, 자체 버블) + 입력창(MUI TextField multiline + 전송 Button + 취소 Button) + 액션 영역("메모로 저장" / "PRD로 저장" Button + 미리보기 Dialog).
     - 미리보기 Dialog: 사용자가 본문을 한 번 더 검토 후 "저장" 클릭 → IPC saveMemo/saveSpec 호출.
     - wiki 출처 칩: AI 메시지 하단에 attached wiki paths 가 있으면 Chip 으로 표시.
  6. **styles.css**: 채팅 surface, 메시지 버블, 헤더 toolbar 스타일.
  7. **scaffold sync**: scaffold/board/scripts 에 chat-once.sh / chat-prompts 같이 두기.
  8. **smoke test**: 정적으로 IPC 노출 / chat-once 존재 / nav 첫 자리 / 기본 진입 화면 / 단일 스레드 경로 / 다음 NNN 계산 로직 / 토글 OFF 분기 / 보드 스냅샷 직렬화 형식을 grep+bash 로 검증.
- Progress: PRD 저장 완료. 다음은 chat-prompts 텍스트 + chat-once.sh 작성.

## Verification

- Command: `npm --prefix apps/desktop run check && bash tests/smoke/desktop-chat-spec-intake-smoke.sh`
- Run file: tickets/done/prd_068/verify_068.md
- Result: pass

## Result

- Summary: 데스크톱 사이드바 첫 자리에 "대화" 메뉴를 추가하고 기본 진입 화면으로 사용. 단일 영속 스레드 `.autoflow/conversations/desktop-chat.md` 와 아카이브 디렉토리, memo/PRD 저장 IPC, chat-once.sh + chat-prompts 텍스트, 보드 스냅샷·wiki answer 카탈로그·매칭 발췌의 system 프롬프트 자동 주입, 자동 요약 임계값 처리, 초기화 시 요약 인계 토글까지 PRD acceptance 전체를 충족. 정적 검증(`npm --prefix apps/desktop run check`) 과 신규 smoke(`tests/smoke/desktop-chat-spec-intake-smoke.sh`) 모두 통과.
- Commit: pending

## Path Notes

- `References` are relative to `BOARD_ROOT`.
- `Allowed Paths` are relative to PROJECT_ROOT (no worktree this ticket).
- `Obsidian Links` use `[[prd_068]]` / `[[Todo-068]]`.
