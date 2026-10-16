import Head from "next/head";
import NewsSummaryPage from "@/components/news-summary/NewsSummaryPage";

/** 기존 뉴스 모아보기와 독립된 일일 뉴스 요약 화면의 진입점입니다. */
export default function NewsSummaryRoute() {
  return (
    <>
      <Head>
        <title>하루 뉴스 | 일일 뉴스 요약</title>
        <meta name="description" content="최근 일주일의 주요 뉴스를 간편하게 읽고 읽은 내용을 이어서 확인하세요." />
        <meta name="theme-color" content="#090c0c" />
      </Head>
      <NewsSummaryPage />
    </>
  );
}
