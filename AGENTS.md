## react-resume 작업 진입점

### 1) 먼저 읽을 문서
- 공통 규칙: `../AGENTS.md`
- 프로젝트 개요: `docs/index.md`
- 도메인 구조: `docs/domain-map.md`
- 검증 기준: `harness/README.md`

### 2) 자동 선독 세부 규칙
- `react-resume` 작업이 식별되면 `docs/index.md`, `docs/domain-map.md`, `harness/README.md`를 먼저 읽고 작업한다.
- 화면 수정, UI 리팩토링, 브라우저 검증은 `../AGENTS/harness/checklists/frontend-screen-change.md`를 함께 확인한다.
- `/api` 연동이나 백엔드 영향이 있으면 `../spring-back-end/AGENTS.md`, `../spring-back-end/docs/index.md`, `../spring-back-end/docs/domain-map.md`, `../spring-back-end/harness/README.md`를 함께 읽는다.

### 3) 프로젝트 경계
- 본 프로젝트는 이력서 프론트엔드를 담당한다.
- 프론트 `/api` 연동 백엔드 코드는 반드시 `../spring-back-end`에 구현한다.
- 프로젝트 상세 규칙은 `docs/`와 `harness/` 아래에 축적한다.

### 4) 기본 검증
- `npm run lint`
- `npm run build`
- 기본 브라우저 직접 오픈 검증은 공통 체크리스트 `../AGENTS/harness/checklists/frontend-screen-change.md`를 따른다.
- 개발 기본 포트는 `3013`이다.

### 5) 금지 및 주의사항
- `/api` 접두사는 임의로 수정하지 않는다.
- 요청 없는 대규모 리포맷, 정렬, 리네이밍은 하지 않는다.
