# 꾸깃 서비스 약관 추가 검증 기록

## 변경과 완료조건
- `/app/notice/kkugit/terms`에서 `KKUGIT_TERMS`의 최신 공개 게시글 제목과 본문을 표시한다.
- `GET /api/resume/notice/kkugit/terms`를 기존 공개 게시판 컨트롤러에 추가했다.
- 개인정보 처리방침과 서비스 약관은 `KkugitNoticePage`에서 표시·조회 중·빈 결과·오류·재시도 처리를 공유한다.
- 최신 한 건 조회는 기존 게시판 서비스·매퍼·정렬 쿼리를 재사용한다. DB 데이터와 구조는 변경하지 않았다.
- 공통 헤더·메뉴·푸터 없이 기존 문서 스타일과 본문 줄바꿈을 유지한다.

## 실제 DB와 API
- 공통 DB 런북의 `codex_robot` 계정으로 다음 조회를 실행했다.

```sql
SELECT BOARD_NO, TITLE, CONTENT
  FROM BOARD_INFO
 WHERE BOARD_DIV_CD = 'KKUGIT_TERMS'
   AND DEL_YN = 'N'
   AND VIEW_YN = 'Y'
 ORDER BY BOARD_NO DESC
 LIMIT 1;
```

- 서비스 약관의 최신 공개 게시글은 `BOARD_NO = 747`, 제목은 `서비스 약관`이었다.
- 기존 개인정보 처리방침은 `BOARD_NO = 746`으로 구분되어 조회됐다.
- `Invoke-WebRequest`로 아래 네 경로를 인증 없이 조회해 모두 HTTP 200과 `Cache-Control: no-store`를 확인했다.
  - `http://127.0.0.1:3010/api/resume/notice/kkugit/terms`
  - `http://127.0.0.1:3010/api/resume/notice/kkugit/privacy`
  - `http://127.0.0.1:3013/api/resume/notice/kkugit/terms`
  - `http://127.0.0.1:3013/api/resume/notice/kkugit/privacy`

## 자동 검증
- `react-resume`: `npm run lint`, `npm run build` 성공. 두 문서의 화면 경로가 빌드 결과에 포함됐다.
- `spring-back-end`: 아래 명령으로 컴파일·리소스 처리·빌드·테스트가 성공했다.

```powershell
$env:JAVA_HOME='D:\react_project\bin\jdk-21.0.9+10'
$env:Path="$env:JAVA_HOME\bin;$env:Path"
.\gradlew.bat compileJava processResources build test
```

- 전체 324건 중 321건 성공, 실패·오류 0건, 기존 조건부 테스트 3건 제외.
- 제외 사유: `NewsMcpHttpClientTests`는 `NEWS_MCP_SDK_TEST=true`, `FtpFileServiceIntegrationTest`는 `RUN_FTP_INTEGRATION_TEST=Y`가 필요하다. `SpringBackEndApplicationTests`는 외부 DB 통합 컨텍스트 제외 정책으로 비활성화되어 있다.
- `ResumeBoardControllerTests`를 문서 구분별로 매개변수화한 4건이 성공했다.
  - 실제 매퍼 SQL과 독립 H2 DB로 최신 공개 글 선택, 더 큰 번호의 비공개·삭제 글 제외, 두 문서 간 구분을 확인했다.
  - 데이터가 없거나 비공개·삭제 글만 있으면 두 API 모두 캐시하지 않는 404 응답을 반환했다.

## 실제 브라우저
- 연결된 Chrome에서 `http://127.0.0.1:3013/app/notice/kkugit/terms`를 직접 열었다.
- 서비스 약관의 제목과 본문 전체가 API 응답과 정확히 일치했다. 검증 시점 본문 길이는 1,978자였다.
- PC 기본 화면과 390×844 모바일 화면에서 흰 배경, 공통 레이아웃 없음, 줄바꿈 보존과 가로 넘침 없음을 확인했다.
- `/app/notice/kkugit/privacy`로 이동해 개인정보 처리방침의 제목과 본문 전체도 API 응답과 일치함을 확인했다. 본문 길이는 1,084자였다.
- 브라우저 경고·오류 로그가 없었다. 임시 뷰포트 설정을 복원하고 생성한 검증 탭을 닫았다.
- 변경 파일의 UTF-8 BOM 없음·LF 줄바꿈 및 두 프로젝트의 `git diff --check`를 확인했다.

## 임시 서버 종료
- `Stop-Process -Id <검증용 PID> -Force`로 직접 실행한 프론트·백엔드와 자식 프로세스를 종료했다.
- 종료한 PID: `51668`, `51716`, `51656`, `51576`, `51736`.
- `Get-Process -Id <종료한 PID>` 확인 결과 남은 프로세스 0건이었다.
- `Get-NetTCPConnection -State Listen` 확인 결과 3010·3013 포트 리스너가 모두 0건이었다.
