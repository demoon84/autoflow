# Wiki Lint Checklist

- [ ] 생성된 각 entry가 ticket 또는 conversation source를 인용한다.
- [ ] Done ticket source 없이 work done을 주장하는 page가 없다.
- [ ] Page가 Claude/Codex가 재사용할 수 있는 `Use When`, `Facts`, `Sources`를 포함한다.
- [ ] 오래될 수 있는 내용에는 `stale_if` 또는 `Stale If`가 있다.
- [ ] Source 없는 확정 단정이 없다.
- [ ] Superseded decision은 `superseded_by`와 `status: superseded`를 포함한다.
- [ ] Link가 안정적인 board-relative path를 사용한다.
- [ ] 최신 `autoflow wiki lint` 실행에서 `stale_reference.*` entry가 남아 있지 않다. 인용된 `tickets/`, `conversations/` path는 disk에 계속 존재해야 한다.
