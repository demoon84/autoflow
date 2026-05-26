# Legacy Review Role

이 파일은 이전 `verifier` role 호환을 위해 남겨둔 비활성 문서다.

현재 Autoflow topology의 active role은 플래너 러너, 워커 러너, 위키 러너 세 가지다. TODO 구현 뒤에는 워커 러너가 로컬 검증 evidence를 남기고 `worker finalize-approved`를 호출해 sanity gate와 merge target verification rerun을 거쳐 단일 마무리한다.

새 설치, 새 PRD, 새 runner prompt는 이 문서를 active role contract로 사용하지 않는다.
