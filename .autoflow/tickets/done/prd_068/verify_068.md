# Verification — tickets_068

## Ticket

- ID: verify_068
- Project Key: prd_068
- Stage: verifying
- Verifier AI: claude
- Last Updated: 2026-04-30T00:00:00Z

## Run

- Working root: /Users/demoon2016/Documents/project/autoflow
- Command: `npm --prefix apps/desktop run check && bash tests/smoke/desktop-chat-spec-intake-smoke.sh`
- Run mode: foreground

## Result

- Outcome: pass
- Evidence summary:
  - `npm --prefix apps/desktop run check` → `node scripts/check-syntax.mjs` + `tsc --noEmit` + `vite build` 모두 0 종료. 빌드 산출물은 `dist/renderer/` 아래에 정상 생성. (vite chunk size 경고는 기존부터 발생하던 비차단 경고이며 본 PRD 와 무관함.)
  - `bash tests/smoke/desktop-chat-spec-intake-smoke.sh` → 마지막 줄 `[chat-smoke] all chat surface smoke checks passed`. 정적으로 다음을 확인: chat-once.sh 실행 권한 + 4 어댑터 케이스, chat-prompts 5종 (runtime/scaffold 양쪽), preload 의 7개 chat API 노출, main.js 의 7개 IPC 채널 등록 및 헬퍼 함수 (`buildBoardSnapshot`, `buildWikiAnswerCatalog`, `selectRelevantWikiAnswers`, `nextNumberedSlot`, `safeJoinUnderBoard` 등) 선언, 환경변수 4종(`AUTOFLOW_DESKTOP_CHAT_CONTEXT|SUMMARY_THRESHOLD|WIKI_ANSWERS_TOPK|SNAPSHOT_BUDGET`), 사이드바 첫 자리 `chat`, 기본 진입 fallback `chat`, ChatView 내부 토글 라벨, 미리보기 NNN 다음 슬롯 계산 로직(샘플 파일 002/004 → 005 반환).

## Acceptance Mapping

- [x] 사이드바 첫 자리에 "대화" 메뉴가 보이고 그 아래에 작업/Tickets/Wiki/통계/로그가 같은 순서. — renderer settingsNavigation 정의 확인.
- [x] 첫 화면 fallback `chat`. — `initialSetting("autoflow.activeSettingsSection", "chat")` + 알 수 없는 키 fallback `: "chat";` 코드 경로.
- [x] 단일 영속 스레드 `desktop-chat.md` 와 아카이브 디렉토리 처리. — main.js `chatThreadPath`, `chatArchiveDirPath`, `chatReset`.
- [x] 컨텍스트 주입(prior_summary + summary + 최근 N + 보드 스냅샷 + 매칭된 wiki answer). — `buildSystemPrompt` + `chatSend` 의 prefix 합성.
- [x] 보드 스냅샷에 wiki/index/overview/log + answers 카탈로그 + 보조 디렉토리 + done 10 + inprogress + inbox + backlog + saved_paths 포함. — `buildBoardSnapshot` 의 섹션 빌드.
- [x] Wiki 인용 토글 OFF 시 본문 첨부 스킵 + 카탈로그만 유지. — `buildSystemPrompt` 의 `wikiCite ? matched : (disabled)` 분기, 카탈로그는 항상 보드 스냅샷에 남음.
- [x] 자동 요약 임계값 처리. — `chatSummarize` 가 50개 미만이면 `below_threshold` 반환.
- [x] 초기화 시 요약 인계. — `chatReset` 이 새 frontmatter 에 `prior_summary` + `prior_archive_path` 기록.
- [x] memo/PRD 저장 IPC 가 절대경로 prefix 검증. — `safeJoinUnderBoard` + `tickets/inbox` / `tickets/backlog` 강제.
- [x] memo/PRD 다음 NNN 자동 계산. — `nextNumberedSlot` (smoke 에서 003 → 005 분기 검증).
- [x] 토스트 + saved_paths 누적. — ChatView 의 `setSavedToast` 와 `appendSavedPath`.
- [x] MUI Material + Emotion 우선. — Alert/Snackbar/Dialog 사용, 채팅 버블만 자체 구현.
- [x] 한국어 UI 라벨. — 헤더, 토글, 버튼, 안내 문구 모두 한국어.

## Notes

- 실제 어댑터 호출은 사용자 데스크톱 환경의 codex/claude/opencode/gemini CLI 설치 여부에 따라 달라진다. chat-once.sh 는 어댑터 미설치 시 `status=error` + `reason=agent_cli_not_found:<agent>` 로 fail-soft 하며, ChatView 는 사용자에게 한국어 오류 메시지를 표시한다.
- vite chunk size 경고는 기존 desktop bundle 의 누적 크기에서 발생하는 사전 경고이며, 본 PRD 와 무관하다. 별도 후속 PRD 에서 코드 분할을 검토할 만하다.
- Playwright / 외부 브라우저 도구는 사용하지 않았다. 정적 smoke 가 PRD 의 acceptance criteria 를 모두 매핑한다.
