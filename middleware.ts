import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 스니펫 라우트 접근 시 로그인 쿠키를 기준으로 보호합니다.
export function middleware(request: NextRequest) {
	const { pathname, search } = request.nextUrl;

	// 로그인 페이지는 항상 접근 가능하도록 둡니다.
	if (pathname === "/snippet/login") {
		return NextResponse.next();
	}

	// 사용자번호 쿠키가 있으면 보호 라우트 접근을 허용합니다.
	const snippetUserNo = request.cookies.get("snippet_user_no")?.value ?? "";
	if (snippetUserNo.trim() !== "") {
		return NextResponse.next();
	}

	// 보호 라우트 비로그인 접근은 로그인 페이지로 리다이렉트합니다.
	const loginUrl = new URL("/snippet/login", request.url);
	loginUrl.searchParams.set("returnUrl", `${pathname}${search}`);
	return NextResponse.redirect(loginUrl);
}

export const config = {
	matcher: ["/snippet/:path*"],
};
