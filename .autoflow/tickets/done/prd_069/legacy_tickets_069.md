# Ticket

## Ticket

- ID: legacy_Todo-069
- PRD Key: prd_069
- Plan Candidate: 데스크톱 대화 UI claude 스타일 + 이미지 첨부
- Title: 데스크톱 대화 UI 다듬기 + 이미지 첨부
- Stage: done
- AI: ticket-owner
- Claimed By: claude-opus-4-7@desktop
- Execution AI: claude
- Verifier AI: claude
- Last Updated: 2026-04-30T00:00:00Z

## Goal

- 데스크톱 "대화" 화면을 claude.ai 스타일 메시지 레이아웃(max-width 가운데 정렬, 사용자 우측 버블 / AI 좌측 본문 + 아바타, 상대 시간) 으로 다듬고, 같은 화면에서 이미지 첨부(드래그&드롭/파일 선택, 보드 attachments 폴더 저장, 메시지 markdown image, thumbnail + zoom 다이얼로그, 어댑터 path hint) 를 가능하게 한다.

## References

- PRD: tickets/backlog/prd_069.md
- Feature PRD:
- Plan:

## Obsidian Links

- Project Note: [[prd_069]]
- Ticket Note: [[legacy_Todo-069]]

## Allowed Paths

- `apps/desktop/src/main.js`
- `apps/desktop/src/preload.js`
- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`
- `apps/desktop/src/renderer/vite-env.d.ts`
- `apps/desktop/src/components/ui/**`
- `apps/desktop/src/lib/**`
- `tests/smoke/desktop-chat-spec-intake-smoke.sh`

## Worktree

- Branch: (none — PROJECT_ROOT direct work)
- Path: /Users/demoon2016/Documents/project/autoflow
- Base: main
- Created At: 2026-04-30T00:00:00Z

## Done When

- [ ] 채팅 메시지가 claude 스타일(가운데 정렬 max-width, 사용자=우측 버블, AI=좌측 본문 + 아바타) 로 보이고 상대 시간이 표시된다.
- [ ] paperclip 버튼 + drag&drop + chip 제거가 모두 동작한다.
- [ ] 이미지가 `.autoflow/conversations/desktop-chat-attachments/` 로 복사되고 markdown 이미지로 thread 에 저장된다.
- [ ] 메시지 본문의 markdown 이미지가 thumbnail 로 렌더되고 클릭 시 큰 미리보기 다이얼로그가 열린다.
- [ ] 어댑터 프롬프트에 `[Attached image: <path>]` 라인이 첨부된 사용자 메시지 뒤에 자동으로 들어간다.
- [ ] 확장자/사이즈 화이트리스트가 동작하고 거부 시 한국어 오류 메시지가 보인다.
- [ ] `npm --prefix apps/desktop run check` 통과.
- [ ] `bash tests/smoke/desktop-chat-spec-intake-smoke.sh` 통과(IPC 노출 + path prefix 검증 + hint 직렬화 + relative time helper + 헤더 ISO 직접 출력 차단 검증 추가).

## Next Action

- main.js 의 이미지 첨부 IPC 와 chatSend hint 직렬화부터 시작해 preload + types + ChatView + styles + smoke 순으로 마무리한다.

## Resume Context

- Current state: PRD prd_069 저장 후 ticket-owner 모드 시작, mini-plan 작성 완료.
- Last completed action: prd_069 저장 + clear-thread-context, ticket inprogress 등록.
- First thing to inspect on resume: `apps/desktop/src/main.js` 의 desktop chat surface 블록 끝부분(이미 추가된 chat 관련 헬퍼들 다음).

## Notes

- Mini-plan:
  1. **main.js**: `CHAT_ATTACHMENT_DIR_NAME = "desktop-chat-attachments"`, `CHAT_IMAGE_EXT_ALLOWLIST`, `CHAT_DEFAULT_IMAGE_MAX_BYTES`, `chatAttachmentsDirPath()`, `chatPickImages()`, `chatAttachImages()`. `chatSend` 의 user-message-with-attachment 를 직렬화할 때 본문 끝에 `\n\n[Attached image: <보드 상대 경로>]` 라인을 자동 첨부.
  2. **preload.js**: `chatPickImages`, `chatAttachImages` 노출.
  3. **vite-env.d.ts**: 두 IPC 선언 + `AutoflowChatPickResult`, `AutoflowChatAttachResult` 타입.
  4. **renderer/main.tsx**:
     - `formatRelativeTime(at)` helper 추가(방금/N분 전/오늘 오후 HH:mm/어제/YYYY-MM-DD).
     - `ChatAvatar` 작은 컴포넌트(사용자 이니셜 vs AI Sparkles).
     - 메시지 영역에 max-width 760 + 가운데 정렬 wrapper, 사용자=우측 정렬 둥근 버블, AI=좌측 본문+아바타.
     - 본문 markdown 이미지가 들어가도록 MarkdownViewer 의 `img` 처리(또는 본문에서 이미지 markdown 추출 후 thumbnail 로 표시 + 본문 텍스트 분리).
     - 입력창 바: paperclip Button (PickImages dialog), Drag&Drop 영역, 첨부 chip 표시(썸네일+이름+x), 전송 시 `chatAttachImages` 로 복사 후 메시지 markdown 합성.
     - Image preview Dialog (MUI) — thumbnail 클릭 시 원본 표시.
  5. **styles.css**: `.chat-thread`, `.chat-message-row`, `.chat-bubble-user`, `.chat-message-ai`, `.chat-avatar`, `.chat-attachment-chips`, `.chat-attachment-chip`, `.chat-message-image`, `.chat-image-preview-dialog` 등.
  6. **smoke 확장**: 새 IPC 두 개 + path prefix 검증 + hint 직렬화 + `formatRelativeTime` 함수 + 메시지 헤더에 raw ISO 직접 출력 패턴 부재 검증.
- Progress: 시작 단계.

## Verification

- Command: `npm --prefix apps/desktop run check && bash tests/smoke/desktop-chat-spec-intake-smoke.sh`
- Run file: tickets/done/prd_069/verify_069.md
- Result: pass

## Result

- Summary: 데스크톱 대화 화면을 claude.ai 스타일(메시지 max-width 760 가운데 정렬, 사용자=우측 회색 버블 / AI=좌측 본문 + 아바타, 상대 시간 + ISO tooltip) 로 다듬고, 같은 화면에서 이미지 첨부(paperclip + drag&drop, 미리보기 chip, 보드 attachments 폴더 복사, markdown 이미지 thread 저장, thumbnail + zoom dialog, 어댑터 path hint 자동 직렬화) 를 추가했다. 확장자/사이즈 화이트리스트로 안전한 첨부만 보드에 복사된다. `npm --prefix apps/desktop run check` 와 확장된 smoke 모두 통과.
- Commit: pending

## Path Notes

- `References` are relative to `BOARD_ROOT`.
- `Allowed Paths` are relative to PROJECT_ROOT (no worktree this ticket).
- `Obsidian Links` use `[[prd_069]]` / `[[Todo-069]]`.
