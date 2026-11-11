import KkugitNoticePage from "@/components/notice/KkugitNoticePage";

/** 꾸깃 개인정보 처리방침 화면의 진입점입니다. */
export default function KkugitPrivacyPage() {
  // 기존 경로에서 개인정보 처리방침 문서를 공통 화면으로 표시합니다.
  return <KkugitNoticePage noticeType="privacy" />;
}
