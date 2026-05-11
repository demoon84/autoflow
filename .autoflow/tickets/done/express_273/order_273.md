# Autoflow Order

## Order

- Title: doctor 의 `check.tickets_reject` 체크 폐기 — reject 폴더 제거 후 (refactor 2026-05-07) 항상 error 박는 버그
- Express: true
- Priority: high
- Status: ready
- Change Type: code

## Request

`autoflow doctor` 가 `check.tickets_reject=error` 로 status=fail 을 고정 출력한다. 원인: refactor 2026-05-07 에서 `.autoflow/tickets/reject/` 디렉토리 자체를 폐기하고 fail 처리를 inbox retry order 단일 흐름으로 바꿨는데, `packages/cli/doctor-project.sh` 의 reject 폴더 존재 체크가 같이 제거되지 않음. 정상 보드인데 빨간 알람만 띄움.

## Allowed Paths

- packages/cli/doctor-project.sh
- runtime/board-scripts/doctor-project.sh

## Done When

- [ ] `packages/cli/doctor-project.sh` 에서 `check.tickets_reject` 키 emit 라인 제거 (또는 폴더 없음 = ok 로 변경)
- [ ] `runtime/board-scripts/doctor-project.sh` 미러 동기화
- [ ] `bash packages/cli/doctor-project.sh <root> .autoflow | grep tickets_reject` 출력 0건 또는 `=ok`
- [ ] `bash packages/cli/doctor-project.sh <root> .autoflow | grep ^status=` 가 `status=ok` (단 다른 미해결 error 없을 시)

## Verification

- Command: bash packages/cli/doctor-project.sh /Users/demoon2016/Documents/project/autoflow .autoflow | grep -E "^(status|check.tickets_reject)="

## Notes

- Express rationale: 한 줄 shell 검사 제거 + 미러 1회. PRD 없이 처리 가능.
- refactor 2026-05-07 의 retroactive 정합성 작업.
