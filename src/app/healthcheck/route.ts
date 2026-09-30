// 요청마다 서버 상태를 확인할 수 있도록 응답을 정적으로 생성하지 않습니다.
export const dynamic = "force-dynamic";

/**
 * 배치 모니터링에 사용할 프론트 서버의 정상 응답을 반환합니다.
 */
export function GET(): Response {
  // 인증이나 백엔드 호출 없이 현재 서버에서 평문 응답을 생성합니다.
  return new Response("OK", {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
