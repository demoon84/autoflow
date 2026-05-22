# TypeScript Migration Inventory

repo-owned shell migration은 runtime, installable-board, package CLI entrypoint에서 완료됐다.

## 현재 Runtime 계약

- Runner runtime code는 `app/runtime/{runners,system,shared}/`에 있다. 이는 app level이며 board로 복사되지 않는다.
- Board(`<project>/.autoflow/`)는 ticket, log, state, wiki 같은 data만 보유하고 `scripts/` folder를 갖지 않는다. `autoflow upgrade`는 old install에서 남은 `<board>/scripts/`를 제거한다.
- App/CLI는 target board를 가리키는 `AUTOFLOW_BOARD_ROOT`, `AUTOFLOW_PROJECT_ROOT` env var와 함께 physical runtime path를 직접 호출한다.
- CLI entrypoint는 `app/cli/{runners,system,shared}/`와 `app/cli/autoflow.ts`에 있다. 이 코드는 desktop app 안으로 흡수되어 있다.

Legacy shell wrapper는 더 이상 supported runtime contract의 일부가 아니다. `node_modules/` 아래 third-party dependency script는 외부 package content이며 generated board로 복사하지 않는다.
