import Head from "next/head";
import dynamic from "next/dynamic";

// DOMParser를 사용하므로 SSR 비활성화
const NewsPage = dynamic(() => import("@/components/news/NewsPage"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400 text-sm">
      뉴스를 불러오는 중...
    </div>
  ),
});

export default function NewsPageRoute() {
  return (
    <>
      <Head>
        <title>뉴스</title>
        <meta name="description" content="뉴스 모아보기" />
      </Head>
      <NewsPage />
    </>
  );
}
