import Head from "next/head";
import { useEffect, useState } from "react";
import { fetchKkugitPrivacy, type PrivacyBoard } from "@/services/boardApiService";
import styles from "@/styles/PrivacyPolicy.module.css";

/** 공통 메뉴와 헤더 없이 꾸깃의 개인정보 처리방침만 표시합니다. */
export default function KkugitPrivacyPage() {
  const [board, setBoard] = useState<PrivacyBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  // 최초 진입과 재시도 시 공개 게시글을 조회하고 화면 이탈 시 요청을 정리합니다.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);

    /** 조회 결과와 빈 결과를 반영하고 통신 오류를 별도로 안내합니다. */
    async function loadPrivacy() {
      try {
        const result = await fetchKkugitPrivacy(controller.signal);
        if (!controller.signal.aborted) setBoard(result);
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadPrivacy();
    return () => controller.abort();
  }, [retry]);

  /** 실패한 처리방침 조회를 다시 실행합니다. */
  function retryPrivacy() {
    // 재시도 횟수가 바뀌면 기존 요청을 정리하고 새로 조회합니다.
    setRetry(retry + 1);
  }

  // 제목과 본문은 텍스트로 출력해 저장된 줄바꿈과 특수문자를 보존합니다.
  const title = board?.title || "개인정보 처리방침";
  return (
    <>
      <Head>
        <title>{title} | 꾸깃</title>
        <meta name="description" content="꾸깃 개인정보 처리방침을 확인하세요." />
      </Head>
      <main className={styles.page}>
        <article className={styles.policy} aria-labelledby="privacy-title" aria-busy={loading}>
          <h1 id="privacy-title" className={styles.title}>{title}</h1>
          {loading ? (
            <p className={styles.message} role="status">개인정보 처리방침을 불러오는 중입니다.</p>
          ) : error ? (
            <div className={styles.message} role="alert">
              <p>개인정보 처리방침을 불러오지 못했습니다.</p>
              <button type="button" className={styles.retry} onClick={retryPrivacy}>다시 시도</button>
            </div>
          ) : board ? (
            <div className={styles.content}>{board.content || "등록된 내용이 없습니다."}</div>
          ) : (
            <p className={styles.message}>등록된 개인정보 처리방침이 없습니다.</p>
          )}
        </article>
      </main>
    </>
  );
}
