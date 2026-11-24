/** 현재 요약의 표시 순서와 브라우저 뷰포트 기준 카드 위치입니다. */
export type NewsSummaryArticlePosition = {
  dispOrd: number;
  rect?: { top: number; bottom: number };
};

/** 실제 헤더에 닿은 기사와 하단에서 진입한 마지막 기사 후보를 구분합니다. */
export function getNewsSummaryScrollReadOrders(
  articles: NewsSummaryArticlePosition[],
  previousScrollY: number,
  currentScrollY: number,
  viewportHeight: number,
  readLine: number | undefined,
): { headerOrders: number[]; lastOrderAtBottom?: number } {
  const delta = currentScrollY - previousScrollY;
  if (!delta || viewportHeight <= 0 || !articles.length) return { headerOrders: [] };

  const lastArticle = articles[articles.length - 1];
  const last = lastArticle.rect;
  // 이전 화면 하단이 마지막 카드 위에 있었을 때만 진입으로 봅니다.
  // 최초 표시부터 걸쳐 있던 짧은 요약은 작은 스크롤만으로 완료되지 않습니다.
  const enteredLast = last && delta > 0 && viewportHeight - delta < last.top
    && last.top <= viewportHeight;
  const lastOrderAtBottom = enteredLast ? lastArticle.dispOrd : undefined;

  // 헤더 접촉과 마지막 카드 진입을 동시에 확인하되, 앞 카드는 헤더 접촉으로만 읽습니다.
  const headerOrders = readLine !== undefined && readLine >= 0 && readLine < viewportHeight
    ? articles.filter(({ rect }) => rect && rect.top <= readLine && rect.bottom > readLine)
      .map((article) => article.dispOrd)
    : [];
  return { headerOrders, lastOrderAtBottom };
}
