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

    /** 실제 세로 스크롤에서 화면 상단의 기사와 마지막 기사 진입을 확인합니다. */
    function updateReadArticles() {
      frame = 0;
      const currentScrollY = window.scrollY;
      const viewedOrders = getNewsSummaryScrollReadOrders(
        articles.map((article) => {
          const rect = articleRefs.current.get(article.dispOrd)?.getBoundingClientRect();
          return { dispOrd: article.dispOrd, rect };
        }),
        previousScrollY,
        currentScrollY,
        window.innerHeight,
      );
      previousScrollY = currentScrollY;
      if (!viewedOrders.length) return;
      setHistory((current) => {
        // 다른 탭의 기록도 병합해 날짜 전환이나 동시 열람 시 기존 읽음이 사라지지 않게 합니다.
        const stored = loadNewsSummaryReadHistory();
        const read = new Set([...(stored[key] || []), ...(current[key] || []), ...viewedOrders]);
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
  return { articleRefs, readOrders, history };
}
