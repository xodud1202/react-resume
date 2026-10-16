export const NEWS_SUMMARY_READ_STORAGE_KEY = "news-summary-read:v1";

/** 날짜와 시퀀스별 읽은 뉴스의 노출 순서를 저장합니다. */
export type NewsSummaryReadHistory = Record<string, number[]>;

/** 새 시퀀스의 뉴스가 이전 묶음의 읽음 기록을 물려받지 않도록 키를 구성합니다. */
export function getNewsSummaryReadKey(date: string, seq: number): string {
  return `${date}:${seq}`;
}

/** 손상되거나 사용할 수 없는 저장소에서도 안전하게 읽음 기록을 복원합니다. */
export function loadNewsSummaryReadHistory(): NewsSummaryReadHistory {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(NEWS_SUMMARY_READ_STORAGE_KEY) || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    // 올바른 날짜·시퀀스 키와 양의 정수 순번만 화면 상태로 복원합니다.
    return Object.fromEntries(Object.entries(parsed).filter(([key, value]) =>
      /^\d{8}:\d+$/.test(key) && Array.isArray(value),
    ).map(([key, value]) => [key, (value as unknown[]).filter((order): order is number =>
      typeof order === "number" && Number.isInteger(order) && order > 0,
    )]));
  } catch {
    return {};
  }
}

/** 최근 묶음의 읽음 기록을 저장하고 저장소 접근 제한 시 현재 화면 상태를 유지합니다. */
export function saveNewsSummaryReadHistory(history: NewsSummaryReadHistory): void {
  try {
    // 날짜가 오래된 기록부터 정리해 재발행이 많아도 저장 용량을 제한합니다.
    const recent = Object.entries(history).sort(([left], [right]) => right.localeCompare(left, "en", { numeric: true })).slice(0, 40);
    window.localStorage.setItem(NEWS_SUMMARY_READ_STORAGE_KEY, JSON.stringify(Object.fromEntries(recent)));
  } catch {
    // 저장소가 차단된 환경에서도 이번 방문의 읽음 표시는 계속 사용할 수 있습니다.
  }
}
