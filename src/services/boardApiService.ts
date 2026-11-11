/** 꾸깃에서 공개하는 공지 문서의 구분입니다. */
export type KkugitNoticeType = "privacy" | "terms";

/** 공개 처리방침과 약관 화면에서 사용하는 게시글 정보입니다. */
export interface NoticeBoard {
  boardNo: number;
  title: string | null;
  content: string | null;
}

/** 꾸깃의 문서 구분별 최신 공개 게시글을 조회합니다. */
export async function fetchKkugitNotice(noticeType: KkugitNoticeType, signal: AbortSignal): Promise<NoticeBoard | null> {
  // 화면 이탈 시 요청을 취소하고 최신 처리방침 또는 약관을 매번 조회합니다.
  const response = await fetch(`/api/resume/notice/kkugit/${noticeType}`, { signal, cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error("문서를 불러오지 못했습니다.");
  }
  return response.json() as Promise<NoticeBoard>;
}
