## 2026-10-16 일일 뉴스 요약 검증

### 변경과 기준

- 기존 `/news`와 별개인 `/news/summary`를 구현했습니다.
- 실제 `news.NEWS_DAILY`의 날짜별 최대 `SEQ`만 `DISP_ORD` 순으로 표시합니다.
- 오늘을 마지막에 둔 최근 7일 선택, 뉴스 없는 이전 날짜 비활성화, 스크롤 읽음, 날짜·시퀀스별 저장, 모바일·태블릿·PC 너비를 구현했습니다.
- 관련 백엔드는 `spring-back-end`의 기존 일일 뉴스 컨트롤러·서비스·매퍼를 확장했습니다. DB와 스키마는 수정하지 않았습니다.

### DB와 실제 API

기존 `oci-mysql` SSH 터널을 연결하고 런북의 `codex_robot`으로 조회했습니다. `SHOW CREATE TABLE news.NEWS_DAILY`와 다음 조회를 확인했습니다.

```sql
SELECT YYYYMMDD, SEQ, COUNT(*) AS ARTICLE_COUNT, MIN(DISP_ORD), MAX(DISP_ORD)
FROM news.NEWS_DAILY
WHERE YYYYMMDD >= '20261006'
GROUP BY YYYYMMDD, SEQ
ORDER BY YYYYMMDD DESC, SEQ DESC;

EXPLAIN SELECT YYYYMMDD, MAX(SEQ) AS SEQ
FROM news.NEWS_DAILY
WHERE YYYYMMDD BETWEEN '20261010' AND '20261016'
GROUP BY YYYYMMDD;
```

- `20261016` 최대 시퀀스 `4`, 20건, 노출 순서 1~20.
- `20261015` 시퀀스 `1`, 25건. 최근 7일 중 두 날짜만 데이터가 있습니다.
- 날짜·시퀀스 조회는 기존 `IDX_NEWS_DAILY_01(YYYYMMDD, SEQ)`를 사용합니다.
- 로컬 Spring에 `local` 프로필과 `--news.daily.enabled=true`를 적용해 실제 DB 연결을 확인했습니다.
- `Invoke-RestMethod http://127.0.0.1:3010/api/news/daily/summary/dates`: 오늘과 두 날짜 반환.
- `/api/news/daily/summary?yyyymmdd=20261016`: 시퀀스 4, 20건, 순서 1~20.
- 어제 조회: 25건. `20261014`: 빈 배열. `20260230`: HTTP 400.

### 프론트와 백엔드 명령

- `npm.cmd run lint`: 통과.
- `node harness/news-summary.test.cjs`: 3건 통과. 주·월·연도·윤년 경계, 읽음 기록 분리 및 손상·차단 저장소 처리.
- `npm.cmd run build`: 통과. `/news/summary` 경로 생성 확인. 첫 실행은 standalone 산출물 권한 오류였으며 권한을 확보해 동일 명령으로 재실행했습니다.
- 지정 JDK `D:\react_project\bin\jdk-21.0.9+10`을 적용한 `.\gradlew.bat compileJava`, `processResources`, `build`, `test`: 통과.
- 백엔드 전체 315건 중 성공 312건, 실패 0건, 기존 환경 의존 테스트 3건 제외. 제외는 MCP SDK 환경변수 시험, 실제 FTP 쓰기 통합 시험, 기존 전체 앱 컨텍스트 시험입니다. 앱 연결은 별도 실제 로컬 실행으로 확인했습니다.

### 실제 브라우저

`npm.cmd run dev -- --hostname 127.0.0.1`로 실행하고 `http://127.0.0.1:3013/news/summary`를 설치된 전용 Chromium과 Playwright CLI로 확인했습니다.

- 오늘 기본 선택, 토/일/월/화/수/목/금 순서, 뉴스 없는 이전 5일 비활성화.
- 모바일 390px에서 날짜 영역 521px 가로 스크롤, 오늘 버튼이 보이는 초기 위치, 페이지 가로 넘침 없음.
- 처음에는 읽음 0건. 아래로 600px 스크롤 후 3건의 녹색 배경·체크·진행률·저장소 기록 확인.
- 새로고침 시 3건 복원. 어제는 25건·읽음 0건. 오늘 재선택 시 20건·읽음 3건 복원.
- 하단까지 남은 거리 49px에서 20건 전체 읽음·완료 안내 확인.
- 같은 날짜의 시퀀스를 브라우저 모의 응답에서 5로 변경하면 이전 시퀀스의 읽음 3건이 전달되지 않고 0건으로 표시.
- 어제 응답을 지연시킨 뒤 곧바로 오늘을 선택해도 오늘 20건과 본문이 유지됨.
- 503 모의 응답에서 오류 안내 확인 후 모의 응답 제거·재시도 시 실제 20건 복구. 빈 배열 응답의 안내 확인.
- 화면 너비 실측: 모바일 390/390px, 소형 모바일 320/320px, 태블릿 700/1000px, PC 720/1440px. 모두 가로 넘침 없음.
- 화면 크기 변경 시 선택 날짜가 가려지던 부분을 보완하고 320px에서도 선택 버튼이 보임을 재확인.
- 모의 응답과 검증용 읽음 기록은 정리했습니다. 앱 웹뷰 실기기 검증은 연결된 기기가 없어 실행하지 않았습니다.

### SSH와 정리

- 백엔드 `scripts/start-local.ps1 -CheckOnly`: 기존 터널 재사용 성공.
- 사용자가 지정한 원본 키는 OpenSSH 파일 권한 검사에서 거부됐습니다. 기존 `~/.ssh/oci.key`와 키 내용이 같음만 확인했고, 정상 권한 사본으로 13307 포트의 새 터널 생성·자동 종료를 확인했습니다. 키 내용·해시를 출력하거나 원본 권한을 변경하지 않았습니다.
- 검증 브라우저는 `playwright-cli -s=news-summary close`로 종료했습니다.
- 프론트는 이번 실행의 npm/Next 프로세스 트리만 `Stop-Process -Id <이번 실행 PID> -Force`로 종료했습니다.
- Spring PID 6632와 이번 SSH 터널 PID 28256을 `Stop-Process -Id 6632,28256 -Force`에 해당하는 개별 종료로 정리했습니다.
- `Get-NetTCPConnection -State Listen`으로 `3010`, `3013`, `13306`, `13307`의 남은 리스너 0개와 Spring·SSH 프로세스 종료를 확인했습니다.
- 운영 배포는 실행하지 않았습니다.
