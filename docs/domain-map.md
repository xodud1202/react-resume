## react-resume 도메인 구조

### 1) 현재 코드 구조
- `src/pages/`: 페이지 진입점을 관리한다.
- `src/app/healthcheck/route.ts`: 서버 상태 확인용 HTTP 응답을 관리한다.
- `src/components/`: 화면 컴포넌트를 관리한다.
- `src/services/`: 프론트 API 호출과 화면용 서비스 로직을 관리한다.
- `src/styles/`, `src/utils/`: 스타일과 공통 유틸을 관리한다.

### 2) 도메인 책임 기준
- 이력서 관련 화면, 서비스, 타입은 가능한 한 동일 도메인 책임 기준으로 묶는다.
- 백엔드 연동이 필요하면 `spring-back-end`에 구현한다.
- 공통 규칙은 루트 `AGENTS/`와 본 프로젝트 `harness/`를 함께 따른다.

### 3) 문서 확장 규칙
- 이력서 도메인이 세분화되면 본 문서 아래에 하위 문서를 추가한다.
- 상세 판단 기준은 `AGENTS.md`에 누적하지 않고 `docs/`로 내린다.

### 4) 서버 상태 확인
- `GET /healthcheck`는 로그인 없이 HTTP `200`, 평문 본문 `OK`를 반환한다.
- `Cache-Control: no-store`와 동적 라우트를 사용해 요청마다 현재 프론트 서버에서 응답한다.
- `node-batch`의 성공 기준인 HTTP `2xx`와 `body.trim() === "OK"`에 맞춘 응답이다.
- 프론트 서버의 응답 가능 여부만 확인하며, Spring API나 DB의 상태를 조회하지 않는다.

### 5) 꾸깃 공개 문서
- `/app/notice/kkugit/privacy`와 `/app/notice/kkugit/terms`는 공통 메뉴 없이 처리방침과 서비스 약관을 표시한다.
- `src/components/notice/KkugitNoticePage.tsx`에서 문서 표시와 조회 상태 처리를 공유하고 `src/services/boardApiService.ts`로 조회한다.
- `/api/resume/notice/kkugit/privacy`는 `KKUGIT_PRIVACY`, `/api/resume/notice/kkugit/terms`는 `KKUGIT_TERMS`로 조회한다.
- 실제 조회는 `spring-back-end`의 공용 게시판 서비스·매퍼를 사용하며 삭제되지 않은 공개 글 중 게시글 번호가 가장 큰 한 건을 반환한다.
