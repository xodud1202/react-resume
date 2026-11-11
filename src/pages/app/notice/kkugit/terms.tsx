import KkugitNoticePage from "@/components/notice/KkugitNoticePage";

/** 꾸깃 서비스 약관 화면의 진입점입니다. */
export default function KkugitTermsPage() {
  // 서비스 약관 구분을 전달해 최신 공개 약관을 표시합니다.
  return <KkugitNoticePage noticeType="terms" />;
}
