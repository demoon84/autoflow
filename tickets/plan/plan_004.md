# Plan

## Plan

- Plan ID: 004
- Title: public distribution pivot for Autoflow
- Status: ready

## Goal

- `Autoflow` 의 주 배포 경로를 플러그인에서 공개 저장소 + 설치 CLI 로 전환한다.

## Spec References

- Project Spec: `tickets/backlog/autoflow-package-spec.md`
- Feature Spec:
  - `tickets/backlog/public-distribution-spec.md`
  - `tickets/backlog/autoflow-cli-spec.md`

## Scope

- In Scope:
  - 공개 배포 기준 문서화
  - 설치 CLI 엔트리포인트 추가
  - plugin 경로를 보조/보류로 명시
- Out of Scope:
  - package manager 배포
  - remote installer hosting
  - 공개 plugin publication

## Execution Candidates

- [ ] 공개 배포 구조를 README 와 spec 에 반영
- [ ] `bin/autoflow init` 엔트리포인트 추가
- [ ] plugin 경로를 secondary path 로 정리

## Ticket Rules

- Allowed Paths:
  - `README.md`
  - `bin/`
  - `rules/`
  - `scripts/`
- Ticket split notes:
  - 공개 설치기와 package manager 배포는 분리한다.

## Generated Tickets

- 아직 없음

## Notes

- 현재 목표는 공개 저장소에서 바로 쓸 수 있는 설치 경로를 만드는 것이다.
