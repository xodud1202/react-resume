import { useEffect, useRef, useState } from "react";
import {
  fetchNewsSummary,
  fetchNewsSummaryWeek,
  type NewsSummary,
  type NewsSummaryWeek,
} from "@/services/newsSummaryApiService";
import { getNewsSummaryDays } from "@/utils/newsSummaryDate";
import { getNewsSummaryReadKey } from "@/utils/newsSummaryStorage";
import useNewsSummaryRead from "./useNewsSummaryRead";
import styles from "./NewsSummaryPage.module.css";

/** 읽음 상태와 완료 안내에서 사용하는 체크 아이콘입니다. */
function CheckIcon() {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 10 3.2 3.2L15 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

/** 최근 7일의 일일 요약을 스크롤하며 읽는 독립 화면입니다. */
export default function NewsSummaryPage() {
  const [week, setWeek] = useState<NewsSummaryWeek | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [summary, setSummary] = useState<NewsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const dateRailRef = useRef<HTMLElement>(null);
  const { articleRefs, readOrders, history } = useNewsSummaryRead(summary);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");

    /** 최초에는 한국 시간의 오늘을 선택하고 이후에는 선택 날짜의 뉴스만 조회합니다. */
    async function loadNews() {
      try {
        if (!selectedDate) {
          const result = await fetchNewsSummaryWeek(controller.signal);
          if (controller.signal.aborted) return;
          setWeek(result);
          setSelectedDate(result.today);
          return;
        }
        const result = await fetchNewsSummary(selectedDate, controller.signal);
        if (controller.signal.aborted) return;
        setSummary(result);
        // 날짜 버튼에도 최신 조회 결과의 시퀀스를 반영해 재발행 후 읽음을 구분합니다.
        setWeek((current) => current ? {
          ...current,
          dates: [
            ...current.dates.filter((day) => day.yyyymmdd !== selectedDate),
            ...(result.seq ? [{ yyyymmdd: selectedDate, seq: result.seq }] : []),
          ],
        } : current);
        setLoading(false);
      } catch {
        if (controller.signal.aborted) return;
        setError("뉴스를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
        setLoading(false);
      }
    }
    void loadNews();
    return () => controller.abort();
  }, [selectedDate, retry]);

  useEffect(() => {
    /** 최초 진입과 화면 회전 시 오른쪽 끝의 오늘 선택 버튼이 보이도록 이동합니다. */
    function revealSelectedDate() {
      const rail = dateRailRef.current;
      const selected = rail?.querySelector<HTMLElement>('[aria-pressed="true"]');
      if (rail && selected) {
        rail.scrollTo({ left: selected.offsetLeft - rail.offsetLeft - (rail.clientWidth - selected.offsetWidth) / 2 });
      }
    }
    revealSelectedDate();
    window.addEventListener("resize", revealSelectedDate, { passive: true });
    return () => window.removeEventListener("resize", revealSelectedDate);
  }, [week?.today, selectedDate]);

  /** 날짜 전환 전에 이전 본문을 비워 늦게 도착한 응답과 읽음 기록이 섞이지 않게 합니다. */
  function selectDate(date: string) {
    if (date === selectedDate) return;
    setSummary(null);
    setLoading(true);
    setError("");
    window.scrollTo({ top: 0, behavior: "instant" });
    setSelectedDate(date);
  }

  /** 일시적인 조회 오류가 발생한 요청을 다시 실행합니다. */
  function retryLoad() {
    setRetry((current) => current + 1);
  }

  const days = week ? getNewsSummaryDays(week.today) : [];
  const selectedDay = days.find((day) => day.date === selectedDate);
  const articles = summary?.articles || [];
  const readCount = articles.filter((article) => readOrders.has(article.dispOrd)).length;
  const complete = articles.length > 0 && readCount === articles.length;

  return (
    <div className={styles.page}>
      <main className={styles.reader}>
        <header className={styles.stickyHeader}>
          <div className={styles.brandRow}>
            <div className={styles.brand}>
              <span className={styles.brandIcon} aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none"><path d="M6 5h12M6 10h12M6 15h7M6 20h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg>
              </span>
              <div><h1>하루 뉴스</h1><p>가볍게 읽고, 오늘을 알다</p></div>
            </div>
            <span className={styles.edition}>일일 요약</span>
          </div>

          <nav ref={dateRailRef} className={styles.dateRail} aria-label="최근 일주일 뉴스 날짜 선택">
            {days.map((day) => {
              const available = week?.dates.find((date) => date.yyyymmdd === day.date);
              const isToday = day.date === week?.today;
              const hasRead = available && (history[getNewsSummaryReadKey(day.date, available.seq)] || []).length > 0;
              return (
                <button
                  key={day.date}
                  type="button"
                  className={styles.dayButton}
                  disabled={!available && !isToday}
                  aria-pressed={selectedDate === day.date}
                  aria-label={`${day.fullLabel}${isToday ? ", 오늘" : ""}${!available ? ", 뉴스 없음" : ""}`}
                  onClick={() => selectDate(day.date)}
                >
                  <span className={styles.dayLabel}>{day.weekday}</span>
                  <span className={styles.dateLabel}>{isToday ? "오늘" : day.label}</span>
                  <span className={`${styles.dayDot} ${hasRead ? styles.dayDotRead : ""}`} aria-hidden="true" />
                </button>
              );
            })}
            {!week && <p className={styles.weekPlaceholder}>최근 일주일을 확인하고 있어요</p>}
          </nav>

          <div className={styles.progressHeading}>
            <span>{selectedDay?.fullLabel || "오늘의 뉴스"}</span>
            <span className={complete ? styles.progressComplete : styles.progressCount} aria-live="polite">
              {complete && <CheckIcon />}{readCount}<span> / {articles.length} 읽음</span>
            </span>
          </div>
          <div className={styles.progressTrack} role="progressbar" aria-label="뉴스 읽기 진행률" aria-valuemin={0} aria-valuemax={articles.length || 1} aria-valuenow={readCount}>
            <span style={{ width: `${articles.length ? readCount / articles.length * 100 : 0}%` }} />
          </div>
        </header>

        <section className={styles.newsSection} aria-label="선택 날짜의 뉴스 요약" aria-busy={loading}>
          {loading ? (
            <div className={styles.loading} role="status">
              <span className={styles.loadingDot} />오늘의 이야기를 가져오고 있어요
              <div className={styles.skeleton} /><div className={styles.skeleton} />
            </div>
          ) : error ? (
            <div className={styles.message} role="alert"><span className={styles.messageIcon}>!</span><h2>잠시 연결이 어려워요</h2><p>{error}</p><button type="button" onClick={retryLoad}>다시 불러오기</button></div>
          ) : articles.length === 0 ? (
            <div className={styles.message}><span className={styles.messageIcon} aria-hidden="true">☷</span><h2>아직 준비 중인 하루예요</h2><p>이 날짜에 등록된 뉴스 요약이 없어요.<br />뉴스가 있는 다른 날짜를 선택해 주세요.</p><button type="button" onClick={retryLoad}>다시 확인하기</button></div>
          ) : (
            <>
              <div className={styles.listIntro}><h2>{selectedDate === week?.today ? "오늘의 주요 소식" : "이날의 주요 소식"}</h2><span>{articles.length}개의 이야기</span></div>
              <div className={styles.articleList}>
                {articles.map((article, index) => {
                  const isRead = readOrders.has(article.dispOrd);
                  return (
                    <article
                      key={`${summary?.seq}:${article.dispOrd}`}
                      ref={(element) => {
                        // 스크롤 위치 계산은 렌더링된 기사 요소를 기준으로 수행합니다.
                        if (element) articleRefs.current.set(article.dispOrd, element);
                        else articleRefs.current.delete(article.dispOrd);
                      }}
                      className={`${styles.article} ${isRead ? styles.articleRead : ""}`}
                      data-read={isRead}
                      aria-label={`${article.categoryNm}, ${index + 1}번째 뉴스, ${isRead ? "읽음" : "안 읽음"}`}
                    >
                      <div className={styles.articleMeta}>
                        <span className={styles.category}>{article.categoryNm}</span>
                        <span className={styles.articleNumber}>{String(index + 1).padStart(2, "0")}<span> / {articles.length}</span></span>
                        <span className={styles.readStatus}>{isRead ? <><CheckIcon /><span>읽음</span></> : <span className={styles.unreadDot} />}</span>
                      </div>
                      <p className={styles.articleContent}>{article.newsContent}</p>
                    </article>
                  );
                })}
              </div>
              <footer className={`${styles.endMessage} ${complete ? styles.endComplete : ""}`} aria-live="polite">
                <span className={styles.endIcon}><CheckIcon /></span>
                <h2>{complete ? "오늘의 소식, 모두 읽었어요" : "이날의 소식은 여기까지예요"}</h2>
                <p>{complete ? "하루를 이해하는 작은 습관, 내일 또 만나요." : "끝까지 내리면 모든 뉴스가 읽음으로 표시돼요."}</p>
              </footer>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
