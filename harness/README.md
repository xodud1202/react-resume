## react-resume 검증 하네스

### 기본 명령
- `npm run lint`
- `npm run build`

### 화면 검증 기준
- 기본 브라우저 직접 오픈 방식으로 확인한다.
- 포트 기준 URL은 `http://127.0.0.1:3013` 또는 `http://localhost:3013`이다.
- 요청 기능은 실제 페이지 진입, 입력, 저장, 검증 흐름으로 확인한다.
- 세부 화면 검증 흐름은 공통 체크리스트 `../../AGENTS/harness/checklists/frontend-screen-change.md`를 함께 따른다.

### 일일 뉴스 요약 검증
- `node harness/news-summary.test.cjs`로 월말·연말·윤년 경계, 최근 7일 순서, 날짜·시퀀스별 읽음 저장 및 저장소 오류 처리를 확인합니다.
- `/news/summary`에서 오늘 기본 선택, 이전 날짜 활성/비활성, 날짜 전환, 스크롤 읽음과 새로고침 복원, 하단 50px 전체 읽음, 모바일·태블릿·PC 너비를 실제 브라우저로 확인합니다.

### 완료 기준
- lint와 build가 성공해야 한다.
- 실제 화면 기준 시나리오가 확인되어야 한다.
- 미실행 항목은 결과 보고에 이유를 남긴다.

### 주식계좌 손익율 그래프

- `node harness/total-stock-profit-graph.test.cjs`로 날짜 단위와 기간 계산을 확인한다.
- [2026-10-13 그래프 검증 기록](validation-2026-10-13-total-stock-profit-graph.md)에서 DB·브라우저·백엔드 검증 범위와 결과를 확인한다.

### 서버 상태 확인 검증
- 서버 실행 후 `curl.exe -i http://127.0.0.1:3013/healthcheck`로 실제 HTTP 응답을 확인한다.
- 쿠키 없이 HTTP `200`, `Content-Type: text/plain; charset=utf-8`, 본문 `OK`, `Cache-Control: no-store`가 반환되어야 한다.
- 로그인 리다이렉트나 HTML 응답 없이 `node-batch`의 `checkHealth` 결과가 `success: true`여야 한다.
- 임시 서버로 검증했다면 해당 프로세스를 종료하고 사용 포트가 해제되었는지 확인한다.
