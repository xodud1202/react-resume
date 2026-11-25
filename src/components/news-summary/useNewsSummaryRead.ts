import { useEffect, useRef, useState } from "react";
import { getNewsSummaryScrollReadOrders } from "@/utils/newsSummaryReadScroll";
import type { NewsSummary } from "@/services/newsSummaryApiService";
import {
  getNewsSummaryReadKey,
  loadNewsSummaryReadHistory,
  NEWS_SUMMARY_READ_STORAGE_KEY,
  saveNewsSummaryReadHistory,
  type NewsSummaryReadHistory,
} from "@/utils/newsSummaryStorage";

/** 화면 경계에 진입한 기사의 읽음 상태를 날짜·시퀀스별로 기록합니다. */
export default function useNewsSummaryRead(summary: NewsSummary | null) {
  const [history, setHistory] = useState<NewsSummaryReadHistory>({});
  const headerRef = useRef<HTMLElement>(null);
  const articleRefs = useRef(new Map<number, HTMLElement>());

  useEffect(() => {
    // 새로고침과 다른 탭에서 변경한 읽음 기록을 동일한 저장소에서 복원합니다.
    setHistory(loadNewsSummaryReadHistory());
    function handleStorage(event: StorageEvent) {
      if (event.key === NEWS_SUMMARY_READ_STORAGE_KEY || event.key === null) {
        setHistory(loadNewsSummaryReadHistory());
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    if (!summary?.seq || !summary.articles.length) return;
    const key = getNewsSummaryReadKey(summary.yyyymmdd, summary.seq);
    const articles = summary.articles;
    let previousScrollY = window.scrollY;
    let frame = 0;
    let lastCardEntered = false;

    /** 실제 세로 스크롤에서 고정 헤더 아래에 닿은 기사와 마지막 기사 진입을 확인합니다. */
    function updateReadArticles() {
      frame = 0;
      const currentScrollY = window.scrollY;
      const positions = articles.map((article) => ({
        dispOrd: article.dispOrd,
        rect: articleRefs.current.get(article.dispOrd)?.getBoundingClientRect(),
      }));
      const viewportHeight = window.innerHeight;
      const readLine = headerRef.current?.getBoundingClientRect().bottom;
      const { headerOrders, lastOrderAtBottom } = getNewsSummaryScrollReadOrders(
        positions, previousScrollY, currentScrollY, viewportHeight, readLine,
      );
      const movedDown = currentScrollY > previousScrollY;
      previousScrollY = currentScrollY;

      // The last card can enter before the preceding card reaches the header.
      // Keep that entry until the last card leaves the reading area.
      const last = positions[positions.length - 1];
      const lastVisible = last.rect && last.rect.top <= viewportHeight
        && last.rect.bottom > (readLine ?? 0);
      lastCardEntered = Boolean(lastVisible && (lastCardEntered || lastOrderAtBottom !== undefined));
      const completeLast = movedDown && lastCardEntered;

      // At the true scroll limit some final cards can never reach the header.
      // Complete only the visible tail, not cards skipped above the viewport.
      const scroller = document.scrollingElement;
      const maxScrollY = scroller ? scroller.scrollHeight - scroller.clientHeight : 0;
      const tailOrders: number[] = [];
      if (movedDown && lastVisible && maxScrollY > 1 && currentScrollY >= maxScrollY - 1) {
        for (let i = positions.length - 1; i >= 0; i -= 1) {
          const { rect, dispOrd } = positions[i];
          if (!rect || rect.bottom <= (readLine ?? 0) || rect.top >= viewportHeight) break;
          tailOrders.push(dispOrd);
        }
        tailOrders.reverse();
      }

      if (!headerOrders.length && !completeLast && !tailOrders.length) return;
      setHistory((current) => {
        // 다른 탭의 기록도 병합해 날짜 전환이나 동시 열람 시 기존 읽음이 사라지지 않게 합니다.
        const stored = loadNewsSummaryReadHistory();
        const read = new Set([...(stored[key] || []), ...(current[key] || []), ...headerOrders, ...tailOrders]);
        if (completeLast && articles.every(({ dispOrd }) => dispOrd === last.dispOrd || read.has(dispOrd))) {
          read.add(last.dispOrd);
        }
        if (read.size === (current[key] || []).length) return current;
        const next = { ...stored, ...current, [key]: [...read] };
        saveNewsSummaryReadHistory(next);
        return next;
      });
    }

    /** 연속 스크롤 이벤트를 브라우저 렌더링 프레임마다 한 번으로 제한합니다. */
    function handleScroll() {
      if (!frame) frame = window.requestAnimationFrame(updateReadArticles);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.cancelAnimationFrame(frame);
    };
  }, [summary]);

  const readOrders = new Set(summary?.seq ? history[getNewsSummaryReadKey(summary.yyyymmdd, summary.seq)] || [] : []);
  return { headerRef, articleRefs, readOrders, history };
}
