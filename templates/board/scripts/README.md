# Scripts

이 폴더는 생성된 보드에서 바로 쓰는 runtime 훅 스크립트를 둔다.

## Included Hooks

- `start-plan.sh`
- `start-todo.sh`
- `start.sh`
- `start-verifier.sh`

## Root Resolution

스크립트는 두 루트를 구분한다.

- `BOARD_ROOT`: 현재 보드 폴더
- `PROJECT_ROOT`: 실제 제품 코드 루트

해석 순서:

1. `AUTOPILOT_PROJECT_ROOT`
2. `.project-root`
3. `BOARD_ROOT` 의 부모 폴더

## Notes

- 이 폴더에는 보드 운영용 runtime 만 둔다.
- 설치기 자체는 공개 배포 패키지 쪽에서 관리한다.
