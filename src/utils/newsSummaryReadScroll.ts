/** 현재 요약의 표시 순서와 브라우저 뷰포트 기준 카드 위치입니다. */
export type NewsSummaryArticlePosition = {
  dispOrd: number;
  rect?: { top: number; bottom: number };
};

/** 초기 표시·수평 스크롤은 제외하고 실제 세로 이동으로 읽은 항목만 반환합니다. */
export function getNewsSummaryScrollReadOrders(
  articles: NewsSummaryArticlePosition[],
  previousScrollY: number,
  currentScrollY: number,
  viewportHeight: number,
): number[] {
  const delta = currentScrollY - previousScrollY;
  if (!delta || viewportHeight <= 0 || !articles.length) return [];

  const last = articles[articles.length - 1].rect;
  // 빠른 스크롤로 마지막 카드를 한 프레임에 지나쳐도 하단의 진입을 놓치지 않습니다.
  const bottomInsideLast = last && last.top <= viewportHeight && viewportHeight < last.bottom;
  const bottomPassedLast = last && delta > 0 && last.top <= viewportHeight
    && viewportHeight - delta < last.bottom;
  if (bottomInsideLast || bottomPassedLast) return articles.map((article) => article.dispOrd);

  // sticky 헤더가 아니라 실제 화면 위쪽(y=0)을 포함하는 카드만 읽음 처리합니다.
  return articles.filter(({ rect }) => rect && rect.top <= 0 && rect.bottom > 0)
    .map((article) => article.dispOrd);
}
