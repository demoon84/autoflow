# Automations

Autoflow의 기본 실행 모델은 외부 반복 자동화가 아니다. 데스크톱 앱이
장기 실행 PTY 러너를 시작하고, 러너는 시작 시점의 role별 compact scan으로
대기 중인 큐 작업을 확인한다.

이 디렉터리는 자동화와 인접한 계약만 문서화한다. 세부 내용은 역할별
문서로 나누어 둔다.

- [triggers.md](triggers.md): `/aprd`, `/atodo`, CLI intake trigger 계약
- [stop-hook.md](stop-hook.md): focused tick 종료 전 안전 확인 계약
- [legacy-file-watch.md](legacy-file-watch.md): deprecated file-watch fallback 계약
- [operating-principles.md](operating-principles.md): runner와 runner tool 책임 경계
- [topology.md](topology.md): 기본 4-runner 구성과 scaling 원칙
- [non-goals.md](non-goals.md): 설치 보드가 의도적으로 하지 않는 일
- [state/README.md](state/README.md): stop hook, runner identity, context state

Board stage가 권위 있는 상태다. Chat transcript는 권위 있는 상태가 아니다.
