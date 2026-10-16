const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

/** 프로젝트의 실제 날짜·읽음 저장 유틸을 TypeScript 컴파일러로 불러옵니다. */
function loadUtility(file) {
  const sourcePath = path.resolve(__dirname, `../src/utils/${file}.ts`);
  const compiled = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
  });
  const loaded = new Module(sourcePath, module);
  loaded.filename = sourcePath;
  loaded.paths = module.paths;
  loaded._compile(compiled.outputText, sourcePath);
  return loaded.exports;
}

const dates = loadUtility("newsSummaryDate");
const storage = loadUtility("newsSummaryStorage");

// 서버에서 전달한 오늘과 월·연도 경계에서 최근 7일의 날짜 순서를 확인합니다.
test("오늘을 끝으로 토요일부터 금요일까지 표시한다", () => {
  const week = dates.getNewsSummaryDays("20261016");
  assert.deepEqual(week.map((day) => day.weekday), ["토", "일", "월", "화", "수", "목", "금"]);
  assert.equal(week[0].date, "20261010");
  assert.equal(week[6].date, "20261016");
  assert.equal(dates.getNewsSummaryDays("20260102")[0].date, "20251227");
  assert.equal(dates.getNewsSummaryDays("20240301")[5].date, "20240229");
});

// 같은 날짜라도 새 시퀀스의 뉴스가 이전 읽음 상태를 공유하지 않는지 확인합니다.
test("읽음 기록을 날짜와 시퀀스로 나누어 복원한다", () => {
  let value = JSON.stringify({ "20261016:3": [1, 2], "20261016:4": [3, -1, "4"], invalid: [1] });
  global.window = { localStorage: {
    getItem: () => value,
    setItem: (_, next) => { value = next; },
  } };
  assert.deepEqual(storage.loadNewsSummaryReadHistory(), { "20261016:3": [1, 2], "20261016:4": [3] });
  assert.notEqual(storage.getNewsSummaryReadKey("20261016", 3), storage.getNewsSummaryReadKey("20261016", 4));
  storage.saveNewsSummaryReadHistory({ "20261016:4": [1, 2, 3] });
  assert.deepEqual(storage.loadNewsSummaryReadHistory(), { "20261016:4": [1, 2, 3] });
  delete global.window;
});

// 저장소 차단과 손상된 값이 화면 실행을 중단하지 않는지 확인합니다.
test("저장소 접근 불가와 손상된 기록을 안전하게 처리한다", () => {
  global.window = { localStorage: { getItem: () => "잘못된 값", setItem: () => { throw new Error("저장 제한"); } } };
  assert.deepEqual(storage.loadNewsSummaryReadHistory(), {});
  assert.doesNotThrow(() => storage.saveNewsSummaryReadHistory({ "20261016:4": [1] }));
  delete global.window;
  assert.deepEqual(storage.loadNewsSummaryReadHistory(), {});
});
