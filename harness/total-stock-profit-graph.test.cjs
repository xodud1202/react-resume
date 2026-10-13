const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const Module = require("node:module");

// 프로젝트의 TypeScript 컴파일러로 실제 그래프 유틸을 로드합니다.
const sourcePath = path.resolve(__dirname, "../src/components/stock-total/profitGraphUtils.ts");
const compiled = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const utilityModule = new Module(sourcePath, module);
utilityModule.filename = sourcePath;
utilityModule.paths = module.paths;
utilityModule._compile(compiled.outputText, sourcePath);
const { buildProfitGraphView, buildGraphDateTicks, graphDateTime, findNearestGraphPointIndex, resolveGraphProfit, formatGraphProfitRate } = utilityModule.exports;

// 동일 확인일의 원금과 평가금 및 100% 기준 비율을 구성합니다.
function point(checkDt, principalAmt = 1000, checkAmt = 1100) {
  return { checkDt, principalAmt, checkAmt, principalRatio: principalAmt > 0 ? checkAmt / principalAmt * 100 : null };
}

// 사용자 요청의 손실·수익 예시와 0·계산 불가 상태를 검증합니다.
test("손익금과 증감률을 원금 대비 부호가 있는 값으로 표시한다", () => {
  assert.deepEqual(resolveGraphProfit(point("2026-01-01", 1000, 897)), { amount: -103, rate: -10.3 });
  assert.deepEqual(resolveGraphProfit(point("2026-01-02", 1000, 1127)), { amount: 127, rate: 12.7 });
  assert.equal(formatGraphProfitRate(-10.3), "-10.30%");
  assert.equal(formatGraphProfitRate(12.7), "+12.70%");
  assert.equal(formatGraphProfitRate(resolveGraphProfit(point("2026-01-03", 1000, 1000)).rate), "0.00%");
  assert.equal(resolveGraphProfit(point("2026-01-04", 1000, 0)).rate, -100);
  assert.equal(formatGraphProfitRate(resolveGraphProfit(point("2026-01-05", 0, 100)).rate), "계산 불가");
});

// 월·년은 평균이 아닌 마지막 확인일의 금액과 비율을 함께 선택합니다.
test("월·년 마지막 확인일과 원금 100% 비율을 유지한다", () => {
  const source = [point("2025-12-31"), point("2026-01-01", 100, 150), point("2026-01-31", 200, 210), point("2026-02-15", 300, 330)];
  const month = buildProfitGraphView(source, "month", 36);
  assert.deepEqual(month.pointList.map((row) => row.checkDt), ["2025-12-31", "2026-01-31", "2026-02-15"]);
  assert.equal(month.pointList[1].principalRatio, 105);
  assert.deepEqual(buildProfitGraphView(source, "year", 36).pointList.map((row) => row.checkDt), ["2025-12-31", "2026-02-15"]);
  assert.equal(source.length, 4);
});

// 윤년 말일 보정과 최신 데이터 기준의 정확한 기간 경계를 확인합니다.
test("1개월 조회는 윤년 2월 말일을 포함하고 범위 밖 데이터를 제외한다", () => {
  const view = buildProfitGraphView([point("2024-02-28"), point("2024-02-29"), point("2024-03-31")], "day", 1);
  assert.equal(view.startDate, "2024-02-29");
  assert.equal(view.endDate, "2024-03-31");
  assert.equal(view.pointList.length, 2);
});

// 데이터보다 긴 기간은 가장 이른 확인일에서 시작하며 모든 기간 버튼을 검증합니다.
test("1·3·6·12·36개월 범위와 데이터 시작일 보정을 적용한다", () => {
  const source = [point("2020-01-01"), point("2026-01-31"), point("2026-02-28"), point("2026-03-31")];
  for (const [months, startDate] of [[1, "2026-02-28"], [3, "2025-12-31"], [6, "2025-09-30"], [12, "2025-03-31"], [36, "2023-03-31"]]) {
    assert.equal(buildProfitGraphView(source, "day", months).startDate, startDate);
  }
  assert.equal(buildProfitGraphView(source.slice(1), "day", 36).startDate, "2026-01-31");
});

// 이력 표의 50건 페이지 제한이 그래프 유틸에 존재하지 않는지 확인합니다.
test("50건 이상, 희소 날짜와 계산 불가 원금을 유지한다", () => {
  const source = Array.from({ length: 63 }, (_, index) => point(new Date(Date.UTC(2026, 6, 1 + index)).toISOString().slice(0, 10)));
  source[10].principalRatio = null;
  const view = buildProfitGraphView(source, "day", 36);
  assert.equal(view.pointList.length, 63);
  assert.equal(view.pointList[10].principalRatio, null);
  assert.equal(findNearestGraphPointIndex([point("2026-01-01"), point("2026-01-10")], graphDateTime("2026-01-08")), 1);
});

// 빈 데이터·단일 데이터와 날짜 단위별 눈금 형식을 확인합니다.
test("빈 데이터와 단일 날짜를 처리하고 단위별 날짜 축을 생성한다", () => {
  assert.deepEqual(buildProfitGraphView([], "day", 3).pointList, []);
  assert.deepEqual(buildGraphDateTicks(buildProfitGraphView([point("2026-01-01")], "year", 3), "year", 6), ["2026-01-01"]);
  const view = buildProfitGraphView([point("2025-12-31"), point("2026-03-31")], "day", 36);
  const ticks = buildGraphDateTicks(view, "day", 3);
  assert.equal(ticks.length, 3);
  assert.equal(ticks[0], "2025-12-31");
  assert.equal(ticks[2], "2026-03-31");
  assert.deepEqual(buildGraphDateTicks(view, "month", 6), ["2025-12-31", "2026-01-01", "2026-02-01", "2026-03-01"]);
});
