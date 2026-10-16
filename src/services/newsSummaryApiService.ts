/** 화면에 표시하는 일일 뉴스 한 항목입니다. */
export interface NewsSummaryArticle {
  categoryNm: string;
  dispOrd: number;
  newsContent: string;
}

/** 날짜별 최대 시퀀스의 뉴스 묶음입니다. */
export interface NewsSummary {
  yyyymmdd: string;
  seq: number | null;
  articles: NewsSummaryArticle[];
}

/** 최근 일주일의 기준 날짜와 뉴스가 존재하는 날짜입니다. */
export interface NewsSummaryWeek {
  today: string;
  dates: { yyyymmdd: string; seq: number }[];
}

/** 취소 가능한 공개 뉴스 조회 요청을 실행합니다. */
async function fetchSummaryJson<T>(path: string, signal: AbortSignal): Promise<T> {
  // 날짜 전환 시 이전 요청을 취소하고, 최신 뉴스가 캐시로 가려지지 않게 합니다.
  const response = await fetch(`/api/news/daily/summary${path}`, { signal, cache: "no-store" });
  if (!response.ok) {
    throw new Error("뉴스를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
  return response.json() as Promise<T>;
}

/** 한국 시간 기준 오늘과 최근 7일의 뉴스 존재 여부를 조회합니다. */
export function fetchNewsSummaryWeek(signal: AbortSignal): Promise<NewsSummaryWeek> {
  return fetchSummaryJson<NewsSummaryWeek>("/dates", signal);
}

/** 선택 날짜의 최대 시퀀스 뉴스를 노출 순서대로 조회합니다. */
export function fetchNewsSummary(date: string, signal: AbortSignal): Promise<NewsSummary> {
  return fetchSummaryJson<NewsSummary>(`?yyyymmdd=${encodeURIComponent(date)}`, signal);
}
