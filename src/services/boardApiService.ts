/** 공개 처리방침 화면에서 사용하는 게시글 정보입니다. */
export interface PrivacyBoard {
  boardNo: number;
  title: string | null;
  content: string | null;
}

/** 꾸깃의 최신 공개 개인정보 처리방침을 조회합니다. */
export async function fetchKkugitPrivacy(signal: AbortSignal): Promise<PrivacyBoard | null> {
  // 화면 이탈 시 요청을 취소하고 최신 처리방침을 매번 조회합니다.
  const response = await fetch("/api/resume/notice/kkugit/privacy", { signal, cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error("개인정보 처리방침을 불러오지 못했습니다.");
  }
  return response.json() as Promise<PrivacyBoard>;
}
