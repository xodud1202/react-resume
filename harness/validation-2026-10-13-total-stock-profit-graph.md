# 2026-10-13 원금대비손익율 그래프 검증 기록

## 표시 조정 후 검증

- 사용자 첨부 화면을 기준으로 점을 제거하고 원금 대비 증감률 표시로 변경했다. 기존 API의 100% 기준 비율은 유지하고 화면에서 100을 뺀 값으로 표시한다.
- 날짜·원금·평가금·손익을 그래프 바로 위에 글자 크기 12px로 표시한다. 정보 행과 조회기간 버튼의 그래프 간격은 각각 8px다. 데스크톱의 그래프 카드도 내용 높이에 맞춰 629px로 표시되는 것을 확인했다.
- `node harness/total-stock-profit-graph.test.cjs` 6건 통과. -10.30%, +12.70%, 0%, 원금 0, 평가금 0의 -100%를 검증했다.
- 모의 API를 연결한 Playwright 브라우저에서 15개 단위·기간 조합을 확인했다. 모든 조합과 마우스·키보드 탐색에서 SVG의 원형 점은 0개였다.
- 마우스로 선택한 날짜의 `-1,030,000원 (-10.30%)`, 키보드로 선택한 `+1,270,000원 (+12.70%)`, `0원 (0.00%)`를 확인했다.
- 모바일 390px에서 페이지 너비와 내용 너비가 모두 390px이고 그래프와 조회기간이 카드 안에 표시됐다. 단위·기간 조작 중 API 추가 호출은 0건이었다.
- 이번 변경은 프론트 표시만 조정하며 백엔드·DB 코드를 추가로 변경하지 않았다. 이번 화면 검증은 모의 API 기준이며 운영 로그인/API 통합 검증은 수행하지 않았다.
- 최종 `npm.cmd run lint`, `npm.cmd run build`가 모두 통과했다. 브라우저 콘솔 오류·경고는 0건이었다.
- 검증용 세션 `totalstock-adjust`를 CLI `close`로 종료했다. 이번 임시 Next 부모 PID를 확인하고 `taskkill.exe /PID 40356 /T /F`로 종료하여 부모 40356·자식 42536·브라우저 42936의 종료를 확인했다. 시작 전 존재하던 별도 사용자 리스너는 종료 대상으로 삼지 않았다.

## 보안 테스트 실패에 대한 추가 확인

사용자 질문에 따라 지정 JDK 21로 `.\gradlew.bat test --tests com.xodud1202.springbackend.config.SecurityConfigTests`를 다시 실행했다. 11건 모두 동일한 초기화 실패로 테스트를 시작하지 못했다. 최초 원인 메시지는 `Failed to determine a suitable driver class`였다.

테스트의 `@EnableAutoConfiguration`이 DB·JPA 설정까지 초기화하려 하지만 테스트에는 활성 프로파일이 지정되지 않았다. 기본 `application.yml`에는 datasource가 없고 `application-local.yml`, `application-prod.yml`에만 있다. 따라서 테스트 실행에서 datasource를 생성하지 못했다. 11개의 별도 업무 오류나 실제 DB 장애가 확인됐다는 의미는 아니다. 이 질문에 대해서는 원인 확인만 수행했고 테스트 설정을 변경하지 않았다.

아래 기록은 최초 구현 당시의 검증 결과이며, 최초 100% 기준 표시가 현재 화면의 0% 기준 증감률 표시로 조정됐다.

## 변경과 이유

계좌별 전체 이력과 입출금내역 사이에 원금대비손익율 그래프를 추가했다. 기존 서비스가 계산한 전체 확인일 결과로 별도 그래프 원천을 반환하여 50건 페이지와 이력 보기 조건에 따른 누락을 방지했다. 실제 데이터 규모와 실행계획을 확인한 결과 추가 집계 테이블·배치 없이 구현했다.

## 실제 DB 조회

`AGENTS/runbooks/db-query.md`의 `codex_robot` 계정만 사용했다. 데이터 쓰기와 스키마 변경은 수행하지 않았다.

```sql
SELECT COUNT(*), COUNT(DISTINCT REPLACE(CASH_DT, '-', '')), MIN(CASH_DT), MAX(CASH_DT)
FROM MY_STOCK_ACCOUNT_STOCK_CHECK;
SELECT COUNT(*), COUNT(DISTINCT REPLACE(CASH_DT, '-', '')), MIN(CASH_DT), MAX(CASH_DT)
FROM MY_STOCK_ACCOUNT_CASH_HISTORY;
SHOW INDEX FROM MY_STOCK_ACCOUNT_STOCK_CHECK;
SHOW INDEX FROM MY_STOCK_ACCOUNT_CASH_HISTORY;
SELECT COUNT(*) FROM COMMON_CODE WHERE GRP_CD = 'STOCK_ACCOUNT' AND USE_YN = 'Y';
```

- 평가금: 311행, 63일, 20260708~20261013. 입출금: 120행, 51일, 20260501~20261013. 활성 계좌: 5개.
- 평가금에는 `(CASH_DT, STOCK_ACCOUNT_CD)`, 입출금에는 `(CASH_DT, STOCK_ACCOUNT_CD, CASH_IN_OUT_CD)` 인덱스가 있었다.
- 기존 `StockAccountHistoryMapper.xml`의 `getStockAccountCheckRowList`, `getDailySaleAmountList` SQL을 전체 활성 계좌 조건으로 실제 실행하고 각각 `EXPLAIN ANALYZE`를 실행했다.
- 반환 행은 311행과 51행이다. 실행계획의 종료 시간은 약 3.4ms와 0.2ms, 클라이언트 측 단일 소요 시간은 21ms와 8ms였다.
- 작은 원천 전체를 읽는 기존 실행계획이다. 그래프 추가에 따른 새 DB 쿼리는 없다. 운영 동시 부하 테스트는 수행하지 않았다.

## 자동 검증

프론트에서 다음 명령을 실행했다.

```powershell
node harness/total-stock-profit-graph.test.cjs
npm.cmd run lint
npm.cmd run build
```

- 날짜·기간 유틸 테스트 5건 통과.
- lint와 빌드 통과. 모바일 배치 수정 후 마지막 소스를 다시 검사했다.

백엔드에서 지정 JDK를 적용하고 다음 명령을 실행했다.

```powershell
$env:JAVA_HOME='D:\react_project\bin\jdk-21.0.9+10'
$env:Path="$env:JAVA_HOME\bin;$env:Path"
.\gradlew.bat compileJava
.\gradlew.bat processResources
.\gradlew.bat build
.\gradlew.bat test --tests com.xodud1202.springbackend.service.StockAccountHistoryServiceTests
.\gradlew.bat build -x test
```

- 컴파일·리소스 처리 통과. 계좌이력 서비스 테스트 14건 통과. 테스트 제외 빌드 통과.
- 전체 `build`의 테스트 단계는 243건 중 11건 실패·2건 건너뜀이었다. 실패는 기존 `SecurityConfigTests`의 데이터소스 설정 누락으로 발생한 컨텍스트 초기화 오류다. 전체 테스트 통과로 보고하지 않는다.
- 추가한 테스트는 월초 보기와 페이지 offset 50에서도 52일 그래프 원천 유지, 추가 원천 조회 없음, 원금 0·음수의 null, 평가금 0의 0%, 150% 계산을 확인했다.

## 실제 브라우저 검증

- URL: `http://127.0.0.1:3013/work/totalstock`.
- Playwright CLI와 설치된 Chromium headless shell로 확인했다. 시스템 Chrome·Edge는 기동 오류가 발생해 대체했다.
- 실제 DB에서 읽은 63일 데이터를 모의 HTTP 응답에 넣었다. 로그인과 bootstrap도 모의 응답이었다. 실제 로그인 세션과 Spring HTTP API를 연결한 통합 검증은 수행하지 않았다.
- 데스크톱 `1440×1000`, 모바일 `390×844`에서 확인했다.
- 탭 순서, 일/월/년별 축 형식, 기간 5개와 단위 3개의 15개 조합, 100% 중앙선, 3년 선택 시 최초일 표시, 63일 전체 표시를 확인했다.
- 마우스로 최초 확인일을 선택해 실제 조회 데이터의 원금·평가금·비율과 상단 정보를 비교했다. Home/End와 좌우 화살표로 날짜 탐색을 확인했다.
- 단위·기간 조작 중 계좌이력 API 추가 요청은 0건이었다.
- 빈 데이터, 단일 확인일, 원금 0의 계산 불가, 평가금 0의 0%, 100% 위아래 범위를 모의 데이터로 확인했다.
- 모바일에서 페이지 가로 넘침이 없고 그래프·조회기간·안내가 카드 안에 배치되는지 실제 요소 치수와 화면으로 확인했다.
- 최종 브라우저 콘솔 오류·경고는 0건이었다.

## 임시 프로세스 종료

임시 서버는 `node node_modules/next/dist/bin/next dev -p 3013 --hostname 127.0.0.1`로 실행했다. 검증용 Playwright 세션 `totalstock-graph`는 CLI `close`로 종료했다.

서버 프로세스의 명령줄을 확인한 뒤 `taskkill.exe /PID 39672 /T /F`로 종료했다. `Get-NetTCPConnection -State Listen -LocalPort 3013`에서 리스너가 없고 해당 PID가 종료된 것을 확인했다. 실제 DB 원천을 담은 임시 모의 응답 파일도 정리했다.
