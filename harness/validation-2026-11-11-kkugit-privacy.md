# 꾸깃 개인정보 처리방침 검증 기록

## 구현 범위와 완료조건
- 화면 경로: `/app/notice/kkugit/privacy`
- 조회 API: `GET /api/resume/notice/kkugit/privacy`
- 공통 헤더·메뉴·푸터 없이 흰 배경에 제목과 본문만 표시한다.
- `KKUGIT_PRIVACY`, `DEL_YN = 'N'`, `VIEW_YN = 'Y'` 조건을 만족하는 최대 게시글 번호 한 건을 표시한다.
- 본문의 줄바꿈과 빈 줄을 유지하며 조회 중·빈 결과·오류를 구분한다.
- 백엔드는 기존 게시판 서비스·매퍼·게시글 객체를 재사용하며 DB 구조와 데이터를 변경하지 않는다.

## 실제 DB와 API 확인
- 공통 DB 런북의 `codex_robot` 조회 계정으로 아래 쿼리를 실행했다.

```sql
SELECT BOARD_NO, TITLE, CONTENT
  FROM BOARD_INFO
 WHERE BOARD_DIV_CD = 'KKUGIT_PRIVACY'
   AND DEL_YN = 'N'
   AND VIEW_YN = 'Y'
 ORDER BY BOARD_NO DESC
 LIMIT 1;
```

- 최초 요청의 `MAX` 서브쿼리 결과와 정렬·한 건 제한 결과가 모두 `BOARD_NO = 746`, 제목 `개인정보 처리방침`으로 일치했다.
- `SHOW COLUMNS FROM BOARD_INFO`로 게시글 번호 기본키와 제목·본문·공개·삭제 컬럼을 확인했다.
- `curl.exe -sS -i http://127.0.0.1:3010/api/resume/notice/kkugit/privacy` 결과: 인증 없이 HTTP 200, `Cache-Control: no-store`, 실제 제목·본문 반환.
- `curl.exe -sS -i http://127.0.0.1:3013/api/resume/notice/kkugit/privacy` 결과: 프론트 프록시를 통해 같은 HTTP 200 응답 반환.

## 자동 검증
- `react-resume`: `npm run lint`, `npm run build` 성공. 빌드 결과에 요청한 화면 경로가 생성됐다.
- `spring-back-end`: 아래 고정 JDK를 적용한 빌드·테스트 성공.

```powershell
$env:JAVA_HOME='D:\react_project\bin\jdk-21.0.9+10'
$env:Path="$env:JAVA_HOME\bin;$env:Path"
.\gradlew.bat compileJava processResources build test
```

- 전체 322건 중 319건 성공, 기존 조건부 테스트 3건 제외, 실패·오류 0건.
- 제외 사유: `NewsMcpHttpClientTests`는 `NEWS_MCP_SDK_TEST=true`가 필요하고, `FtpFileServiceIntegrationTest`는 `RUN_FTP_INTEGRATION_TEST=Y`가 필요하다. `SpringBackEndApplicationTests`는 외부 DB 통합 컨텍스트 제외 정책으로 비활성화되어 있다.
- 추가한 `ResumeBoardControllerTests` 2건은 운영 매퍼 XML과 H2를 사용해 아래를 확인했다.
  - 이전 글과 더 큰 번호의 비공개·삭제·다른 게시판 글이 있어도 최신 공개 꾸깃 방침만 반환하고 본문 개행을 보존한다.
  - 데이터가 없거나 비공개·삭제 글만 있으면 캐시하지 않는 404 응답을 반환한다.
- 변경 파일의 UTF-8 BOM 없음·LF 줄바꿈과 `git diff --check`를 확인했다.

## 실제 브라우저 확인
- URL: `http://127.0.0.1:3013/app/notice/kkugit/privacy`
- Playwright CLI의 별도 Chrome·Edge 프로세스가 시작 직후 종료되어 연결된 Chrome 탭으로 검증했다.
- PC 기본 화면과 390×844 모바일 화면에서 제목·본문, 흰 배경, 공통 메뉴 없음, 본문 줄바꿈과 빈 줄 유지를 확인했다.
- 모바일 뷰포트와 문서 너비가 모두 390으로 가로 넘침이 없었다.
- 브라우저 경고·오류 로그가 없었다. 검증 후 뷰포트 설정을 복원하고 생성한 탭을 닫았다.

## 임시 서버 종료
- `Stop-Process -Id <검증용 PID> -Force`로 직접 실행한 프론트·백엔드와 자식 프로세스를 종료했다.
- 종료한 PID: `51168`, `50620`, `45160`, `40456`, `48512`.
- `Get-Process -Id <종료한 PID>` 확인 결과 남은 프로세스 0건.
- `Get-NetTCPConnection -State Listen`에서 3010·3013 포트 리스너 0건을 확인했다.
