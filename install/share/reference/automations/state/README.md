# Automation State

Stop hook, runner identity, context continuity를 위한 runtime state를 보관한다.

세부 문서는 다음 파일로 나누어 둔다.

- [context-lifecycle.md](context-lifecycle.md): context file 위치와 tick 종료 처리
- [worker-identity.md](worker-identity.md): runner identity environment variable

Runtime state는 resume의 보조 자료다. 실제 작업 재개는 chat history가 아니라 ticket,
reference, log, `Resume Context`를 기준으로 한다.
