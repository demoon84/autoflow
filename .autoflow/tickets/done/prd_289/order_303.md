# Autoflow Order

## Order

- Title: Push 자동화 opt-in — branch_only 모드 (PR 브랜치 push + draft PR 자동, master 금지 유지)
- Priority: normal
- Status: ready
- Change Type: code

## Request

자율주행 도착지가 "PR 머지" 라면 현재는 push 가 수동이라 직전에 늘 끊긴다.
AGENTS.md rule 8 의 "git push 금지" 1원칙을 master 에 대해서만 유지하고,
PR 브랜치 push + draft PR 생성까지는 opt-in 으로 자동화한다.

해야 할 것:
1. AUTOFLOW_AUTO_PUSH_AFTER_VERIFY 환경변수 신설 (기본 off)
   - off: 현 동작 (push 금지)
   - branch_only: PR 브랜치 push + draft PR 자동 생성, master push 는 계속 차단
2. finish-ticket-owner.ts 가 sanity gate 통과 후 branch_only 모드면
   `git push origin <feature-branch>` + `gh pr create --draft --body-file
   .autoflow/runners/state/pr-drafts/<ticket-id>.md` 자동 실행
3. master/main push 시도는 모든 모드에서 차단 (rule 8 보전)
4. AGENTS.md rule 8 본문 갱신 — opt-in 정책 한 단락 추가, master push 영원히
   금지 명시
5. gh CLI 미설치 / 인증 실패 시 silent skip + 사용자에게 PR draft 경로 안내
   (1원칙: 흐름 차단 금지)

## Allowed Paths

- .autoflow/scripts/finish-ticket-owner.sh
- .autoflow/scripts/finish-ticket-owner.ts
- AGENTS.md
- CLAUDE.md

## Done When

- [ ] AUTOFLOW_AUTO_PUSH_AFTER_VERIFY=off (기본) 시 push 시도 0건 (회귀)
- [ ] =branch_only 시 worker pass 후 자동 push 성공 + draft PR 생성 확인
- [ ] master/main 브랜치로 push 시도 시 모든 모드에서 차단 (회귀)
- [ ] gh 미설치/미인증 환경에서 silent skip + 흐름 진행 (sanity gate 통과는 유지)
- [ ] AGENTS.md rule 8 본문 opt-in 정책 명시

## Verification

- Command: fixture feature branch 에서 pass 실행 후 gh pr list 로 draft PR 확인;
  master 브랜치 push 시도는 차단되는지 별도 검증

## Notes

- Acceptance Probe(order_293) + Verifier(order_294) 머지 후 진행 권장 — 검증
  강화 선행 시 자동 push 의 안전성 상승
- PR draft 본문은 PRD 6 의 pr-drafts/<ticket-id>.md 재사용
- master push 영원히 금지 — 본 ticket 은 그 원칙을 완화하지 않음
