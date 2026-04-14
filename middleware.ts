import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 스니펫과 업무관리 라우트 접근 시 로그인 쿠키를 기준으로 보호합니다.
export function middleware(request: NextRequest) {
	const { pathname, search } = request.nextUrl;

	// 각 도메인의 로그인 페이지는 항상 접근 가능하도록 둡니다.
	if (pathname === "/snippet/login" || pathname === "/work/login") {
		return NextResponse.next();
	}

	// 스니펫 보호 라우트는 snippet 전용 쿠키를 확인합니다.
	if (pathname.startsWith("/snippet")) {
		const snippetUserNo = request.cookies.get("snippet_user_no")?.value ?? "";
		if (snippetUserNo.trim() !== "") {
			return NextResponse.next();
		}

		const loginUrl = new URL("/snippet/login", request.url);
		loginUrl.searchParams.set("returnUrl", `${pathname}${search}`);
		return NextResponse.redirect(loginUrl);
	}

	// 업무관리 보호 라우트는 work 전용 쿠키를 확인합니다.
	if (pathname.startsWith("/work")) {
		const workUserNo = request.cookies.get("work_user_no")?.value ?? "";
		if (workUserNo.trim() !== "") {
			return NextResponse.next();
		}

		const loginUrl = new URL("/work/login", request.url);
		loginUrl.searchParams.set("returnUrl", `${pathname}${search}`);
		return NextResponse.redirect(loginUrl);
	}

	// 그 외 라우트는 그대로 통과시킵니다.
	return NextResponse.next();
}

export const config = {
	matcher: ["/snippet/:path*", "/work/:path*"],
};
