export interface SnippetClientApiRequestOptions extends Omit<RequestInit, "body"> {
	body?: BodyInit | object | null;
}

export interface SnippetClientApiResult<T> {
	ok: boolean;
	status: number;
	message: string;
	data: T | null;
}

export interface SnippetSessionRefreshResponse {
	authenticated: boolean;
	snippetUserNo: number | null;
	userNm: string;
	email: string;
	profileImgUrl: string;
}

export interface SnippetGoogleLoginResponse {
	loginSuccess: boolean;
	firstLoginYn: string;
	snippetUserNo: number | null;
	userNm: string;
	email: string;
	profileImgUrl: string;
}

export interface SnippetUserSummary {
	snippetUserNo: number;
	googleSub: string;
	email: string;
	userNm: string;
	profileImgUrl: string | null;
	useYn: string;
	delYn: string;
}

export interface SnippetLanguage {
	languageCd: string;
	languageNm: string;
	editorMode: string;
	sortSeq: number;
}

export interface SnippetFolder {
	folderNo: number;
	snippetUserNo: number;
	folderNm: string;
	colorHex: string | null;
	sortSeq: number;
	snippetCount: number;
}

export interface SnippetTag {
	tagNo: number;
	snippetUserNo: number;
	tagNm: string;
	colorHex: string | null;
	sortSeq: number;
	snippetCount: number;
}

export interface SnippetBootstrapResponse {
	currentUser: SnippetUserSummary;
	languageList: SnippetLanguage[];
	folderList: SnippetFolder[];
	tagList: SnippetTag[];
}

export interface SnippetSummary {
	snippetNo: number;
	title: string;
	summary: string | null;
	languageCd: string;
	languageNm: string;
	favoriteYn: string;
	folderNo: number | null;
	folderNm: string | null;
	tagNameText: string | null;
	lastCopiedDt: string | null;
	regDt: string;
	udtDt: string | null;
}

export interface SnippetListResponse {
	list: SnippetSummary[];
	totalCount: number;
	page: number;
	size: number;
}

export interface SnippetDetailResponse {
	snippetNo: number;
	folderNo: number | null;
	languageCd: string;
	title: string;
	summary: string | null;
	snippetBody: string;
	memo: string | null;
	favoriteYn: string;
	lastCopiedDt: string | null;
	regDt: string;
	udtDt: string | null;
	tagNoList: number[];
}

export interface SnippetSaveRequest {
	folderNo: number | null;
	languageCd: string;
	title: string;
	summary: string | null;
	snippetBody: string;
	memo: string | null;
	favoriteYn: string;
	tagNoList: number[];
}

export interface SnippetSaveResponse {
	snippetNo: number;
	message: string;
}

export interface SnippetFolderSaveRequest {
	folderNm: string;
	colorHex: string | null;
	sortSeq?: number | null;
}

export interface SnippetTagSaveRequest {
	tagNm: string;
	colorHex: string | null;
	sortSeq?: number | null;
}

export interface SnippetListFilter {
	q?: string;
	folderNo?: number | null;
	tagNo?: number | null;
	languageCd?: string;
	favoriteYn?: string;
	page?: number;
	size?: number;
}

// 클라이언트 응답 payload에서 message 문자열을 안전하게 추출합니다.
function resolveSnippetClientMessage(payload: unknown): string {
	if (!payload || typeof payload !== "object" || !("message" in payload)) {
		return "";
	}
	return typeof payload.message === "string" ? payload.message : "";
}

// 객체 body를 JSON 문자열 또는 원본 body로 정규화합니다.
function resolveRequestBody(body: SnippetClientApiRequestOptions["body"]): BodyInit | null | undefined {
	if (body === null || typeof body === "undefined") {
		return body;
	}
	if (typeof body === "string" || body instanceof FormData || body instanceof URLSearchParams || body instanceof Blob) {
		return body;
	}
	return JSON.stringify(body);
}

// 요청 body 유형에 맞는 기본 헤더를 조합합니다.
function resolveRequestHeaders(body: SnippetClientApiRequestOptions["body"], headers: HeadersInit | undefined): HeadersInit | undefined {
	const resolvedHeaderMap = new Headers(headers);
	if (
		body &&
		!(body instanceof FormData) &&
		!(body instanceof URLSearchParams) &&
		!(body instanceof Blob) &&
		!resolvedHeaderMap.has("Content-Type")
	) {
		resolvedHeaderMap.set("Content-Type", "application/json");
	}
	return Array.from(resolvedHeaderMap.keys()).length > 0 ? resolvedHeaderMap : undefined;
}

// 쿼리스트링 문자열을 생성합니다.
function toQueryString(filter: SnippetListFilter): string {
	const searchParams = new URLSearchParams();
	if (typeof filter.q === "string" && filter.q.trim() !== "") {
		searchParams.set("q", filter.q.trim());
	}
	if (typeof filter.folderNo === "number" && filter.folderNo > 0) {
		searchParams.set("folderNo", String(filter.folderNo));
	}
	if (typeof filter.tagNo === "number" && filter.tagNo > 0) {
		searchParams.set("tagNo", String(filter.tagNo));
	}
	if (typeof filter.languageCd === "string" && filter.languageCd.trim() !== "") {
		searchParams.set("languageCd", filter.languageCd.trim());
	}
	if (typeof filter.favoriteYn === "string" && filter.favoriteYn.trim() !== "") {
		searchParams.set("favoriteYn", filter.favoriteYn.trim());
	}
	if (typeof filter.page === "number" && filter.page > 0) {
		searchParams.set("page", String(filter.page));
	}
	if (typeof filter.size === "number" && filter.size > 0) {
		searchParams.set("size", String(filter.size));
	}
	const queryString = searchParams.toString();
	return queryString === "" ? "" : `?${queryString}`;
}

// 클라이언트 공통 API 요청을 수행합니다.
export async function requestSnippetClientApi<T>(
	path: string,
	{ body, headers, credentials = "include", ...restRequestInit }: SnippetClientApiRequestOptions = {},
): Promise<SnippetClientApiResult<T>> {
	try {
		// 공통 옵션으로 API를 호출하고 JSON 응답을 최대한 안전하게 파싱합니다.
		const response = await fetch(path, {
			credentials,
			...restRequestInit,
			headers: resolveRequestHeaders(body, headers),
			body: resolveRequestBody(body),
		});
		const payload = await response.json().catch(() => null);

		return {
			ok: response.ok,
			status: response.status,
			message: resolveSnippetClientMessage(payload),
			data: response.ok ? (payload as T) : null,
		};
	} catch (error) {
		// 취소된 요청은 호출부에서 분기할 수 있도록 그대로 다시 던집니다.
		if (error instanceof DOMException && error.name === "AbortError") {
			throw error;
		}

		// 네트워크 예외가 발생하면 실패 응답을 반환합니다.
		return {
			ok: false,
			status: 500,
			message: "",
			data: null,
		};
	}
}

// 스니펫 세션을 복구합니다.
export async function refreshSnippetSession(): Promise<SnippetClientApiResult<SnippetSessionRefreshResponse>> {
	return requestSnippetClientApi<SnippetSessionRefreshResponse>("/api/snippet/auth/session/refresh", {
		method: "POST",
	});
}

// 스니펫 로그아웃을 수행합니다.
export async function logoutSnippet(): Promise<SnippetClientApiResult<{ message: string }>> {
	return requestSnippetClientApi<{ message: string }>("/api/snippet/auth/logout", {
		method: "POST",
	});
}

// 스니펫 bootstrap 데이터를 조회합니다.
export async function fetchSnippetBootstrap(): Promise<SnippetClientApiResult<SnippetBootstrapResponse>> {
	return requestSnippetClientApi<SnippetBootstrapResponse>("/api/snippet/bootstrap");
}

// 스니펫 목록을 조회합니다.
export async function fetchSnippetList(filter: SnippetListFilter): Promise<SnippetClientApiResult<SnippetListResponse>> {
	return requestSnippetClientApi<SnippetListResponse>(`/api/snippet/snippets${toQueryString(filter)}`);
}

// 스니펫 상세를 조회합니다.
export async function fetchSnippetDetail(snippetNo: number): Promise<SnippetClientApiResult<SnippetDetailResponse>> {
	return requestSnippetClientApi<SnippetDetailResponse>(`/api/snippet/snippets/${snippetNo}`);
}
