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

test("header is compact from the first render without scroll resizing", () => {
  const page = fs.readFileSync(path.resolve(__dirname, "../src/components/news-summary/NewsSummaryPage.tsx"), "utf8");
  assert.ok(page.includes('styles.stickyHeader} ${styles.headerCompact}'));
  assert.ok(page.includes('data-compact="true"'));
  assert.ok(!page.includes("setHeaderCompact"));
  assert.ok(!page.includes("getNewsSummaryHeaderCompact"));
});

test("reader uses tighter justified text without stretching final lines", () => {
  const css = fs.readFileSync(path.resolve(__dirname, "../src/components/news-summary/NewsSummaryPage.module.css"), "utf8");
  assert.match(css, /word-break: break-all/);
  assert.match(css, /text-align: justify/);
  assert.match(css, /text-align-last: start/);
  assert.match(css, /line-height: 1.65/);
  assert.match(css, /min-height: 48px/);
});

const scrollRead = loadUtility("newsSummaryReadScroll").getNewsSummaryScrollReadOrders;
const position = (dispOrd, top, bottom) => ({ dispOrd, rect: { top, bottom } });
const farLast = position(9, 2000, 2300);

test("initial paint and horizontal-only scroll never mark articles read", () => {
  assert.deepEqual(scrollRead([position(1, -5, 100), position(2, 700, 900)], 0, 0, 800), []);
});

test("viewport top must enter a card, not merely show its bottom", () => {
  assert.deepEqual(scrollRead([position(1, 10, 300), farLast], 0, 10, 800), []);
  assert.deepEqual(scrollRead([position(1, 0, 300), farLast], 10, 20, 800), [1]);
  assert.deepEqual(scrollRead([position(1, -100, 0), farLast], 20, 30, 800), []);
});

test("gaps and cards already above the viewport are not read", () => {
  assert.deepEqual(scrollRead([position(1, -300, -10), position(2, 10, 300), farLast], 0, 100, 800), []);
});

test("middle jumps only read the card containing viewport top", () => {
  assert.deepEqual(scrollRead([position(1, -600, -400), position(2, -350, -100), position(3, -20, 300), farLast], 0, 600, 800), [3]);
});

test("upward vertical scrolling also reads the card at the viewport top", () => {
  assert.deepEqual(scrollRead([position(1, -100, 100), farLast], 500, 400, 800), [1]);
});

test("viewport bottom entering the last card marks this summary read", () => {
  assert.deepEqual(scrollRead([position(2, -100, 100), position(7, 801, 1100)], 0, 10, 800), [2]);
  assert.deepEqual(scrollRead([position(2, -100, 100), position(7, 800, 1100)], 10, 11, 800), [2, 7]);
});

test("a fast downward jump across the final card still completes", () => {
  assert.deepEqual(scrollRead([position(1, -1400, -1000), position(3, 100, 400)], 0, 1200, 800), [1, 3]);
  assert.deepEqual(scrollRead([position(1, -1500, -1100), position(3, -200, 0)], 1200, 1300, 800), []);
});

test("the final item is determined by display order, not the largest key or a missing ref", () => {
  assert.deepEqual(scrollRead([position(9, 700, 900), { dispOrd: 1 }], 0, 100, 800), []);
  assert.deepEqual(scrollRead([position(9, -20, 100), position(1, 800, 1000)], 0, 100, 800), [9, 1]);
  assert.deepEqual(scrollRead([], 0, 100, 800), []);
});

/** 실제 hook을 작은 React/브라우저 대역으로 실행해 저장과 정리까지 검사합니다. */
function mountReadHook(summary, initialStorage = "{}", scrollY = 0) {
  let history;
  let storageValue = initialStorage;
  let writes = 0;
  const listeners = new Map();
  const frames = new Map();
  const effects = [];
  let nextFrame = 1;
  global.window = {
    scrollY, innerHeight: 800,
    localStorage: { getItem: () => storageValue, setItem: (_, value) => { storageValue = value; writes += 1; } },
    addEventListener: (name, listener) => listeners.set(name, listener),
    removeEventListener: (name, listener) => { if (listeners.get(name) === listener) listeners.delete(name); },
    requestAnimationFrame: (callback) => { const id = nextFrame++; frames.set(id, callback); return id; },
    cancelAnimationFrame: (id) => frames.delete(id),
  };
  const react = {
    useState: (initial) => { history = initial; return [history, (update) => { history = typeof update === "function" ? update(history) : update; }]; },
    useRef: (current) => ({ current }),
    useEffect: (callback) => effects.push(callback),
  };
  const sourcePath = path.resolve(__dirname, "../src/components/news-summary/useNewsSummaryRead.ts");
  const compiled = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } });
  const loaded = new Module(sourcePath, module);
  loaded.filename = sourcePath;
  loaded.paths = module.paths;
  loaded.require = (name) => {
    if (name === "react") return react;
    if (name === "@/utils/newsSummaryStorage") return storage;
    if (name === "@/utils/newsSummaryReadScroll") return { getNewsSummaryScrollReadOrders: scrollRead };
    throw new Error("Unexpected hook import: " + name);
  };
  loaded._compile(compiled.outputText, sourcePath);
  const result = loaded.exports.default(summary);
  const cleanup = effects.map((effect) => effect());
  return {
    refs: result.articleRefs.current,
    get history() { return history; },
    get writes() { return writes; },
    get pending() { return frames.size; },
    scroll: (y) => { window.scrollY = y; listeners.get("scroll")?.(); },
    flush: () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach((callback) => callback()); },
    dispose: () => { cleanup.forEach((fn) => fn?.()); delete global.window; },
    listeners,
  };
}
const sampleSummary = { yyyymmdd: "20261123", seq: 2, articles: [{ dispOrd: 1 }, { dispOrd: 2 }] };

test("hook restores and merges persisted reads without writing on mount or repeat scroll", () => {
  const mounted = mountReadHook(sampleSummary, JSON.stringify({ "20261122:1": [2], "20261123:2": [2] }));
  try {
    mounted.refs.set(1, { getBoundingClientRect: () => ({ top: -10, bottom: 100 }) });
    mounted.refs.set(2, { getBoundingClientRect: () => ({ top: 2000, bottom: 2500 }) });
    assert.equal(mounted.writes, 0);
    mounted.scroll(0); mounted.flush();
    assert.equal(mounted.writes, 0);
    mounted.scroll(10); mounted.scroll(20);
    assert.equal(mounted.pending, 1);
    mounted.flush();
    assert.deepEqual(mounted.history, { "20261122:1": [2], "20261123:2": [2, 1] });
    assert.equal(mounted.writes, 1);
    mounted.scroll(30); mounted.flush();
    assert.equal(mounted.writes, 1);
  } finally { mounted.dispose(); }
});

test("restored position waits for actual vertical scroll and new sequence remains separate", () => {
  const mounted = mountReadHook(sampleSummary, JSON.stringify({ "20261123:1": [1, 2] }), 600);
  try {
    mounted.refs.set(1, { getBoundingClientRect: () => ({ top: -10, bottom: 100 }) });
    mounted.refs.set(2, { getBoundingClientRect: () => ({ top: 2000, bottom: 2500 }) });
    mounted.scroll(600); mounted.flush();
    assert.equal(mounted.history["20261123:2"], undefined);
    mounted.scroll(601); mounted.flush();
    assert.deepEqual(mounted.history["20261123:2"], [1]);
    assert.deepEqual(mounted.history["20261123:1"], [1, 2]);
  } finally { mounted.dispose(); }
});

test("hook removes listeners and cancels queued work on summary change or unmount", () => {
  const mounted = mountReadHook(sampleSummary);
  mounted.scroll(100);
  assert.equal(mounted.pending, 1);
  mounted.dispose();
  assert.equal(mounted.pending, 0);
  assert.equal(mounted.listeners.size, 0);
  assert.equal(mounted.writes, 0);
});
