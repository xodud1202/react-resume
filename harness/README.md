## react-resume 검증 하네스

### 기본 명령
- `npm run lint`
- `npm run build`

### 화면 검증 기준
- 기본 브라우저 직접 오픈 방식으로 확인한다.
- 포트 기준 URL은 `http://127.0.0.1:3013` 또는 `http://localhost:3013`이다.
- 요청 기능은 실제 페이지 진입, 입력, 저장, 검증 흐름으로 확인한다.
- 세부 화면 검증 흐름은 공통 체크리스트 `../../AGENTS/harness/checklists/frontend-screen-change.md`를 함께 따른다.

### 완료 기준
- lint와 build가 성공해야 한다.
- 실제 화면 기준 시나리오가 확인되어야 한다.
- 미실행 항목은 결과 보고에 이유를 남긴다.
