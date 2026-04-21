import type {
	WorkBootstrapResponse,
	WorkDetail,
	WorkDetailResponse,
	WorkDetailUpdateRequest,
	WorkFile,
	WorkFileDownloadData,
	WorkFileDeleteRequest,
	WorkImportRequest,
	WorkImportResponse,
	WorkListFilter,
	WorkListResponse,
	WorkListRow,
	WorkLoginRequest,
	WorkManualCreateRequest,
	WorkManualCreateResponse,
	WorkProjectOption,
	WorkReply,
	WorkReplyDeleteRequest,
	WorkReplyFile,
	WorkReplySaveRequest,
	WorkReplyUpdateRequest,
	WorkSessionRefreshResponse,
	WorkStatusSection,
	WorkStatusSectionPageResponse,
} from "@/components/work/types";

// 업무관리 클라이언트 API 요청 옵션을 정의합니다.
export interface WorkClientApiRequestOptions extends Omit<RequestInit, "body"> {
	// 요청 본문입니다.
	body?: BodyInit | object | null;
}

// 업무관리 공통 API 응답 래퍼를 정의합니다.
export interface WorkClientApiResult<T> {
	// 성공 여부입니다.
	ok: boolean;
	// HTTP 상태코드입니다.
	status: number;
	// 메시지입니다.
	message: string;
	// 응답 데이터입니다.
	data: T | null;
}

// 배열 응답을 안전하게 정규화합니다.
function resolveArrayValue<T>(value: T[] | undefined | null): T[] {
	return Array.isArray(value) ? value : [];
}

// 문자열 메시지를 응답 payload에서 안전하게 추출합니다.
function resolveWorkClientMessage(payload: unknown): string {
	if (!payload || typeof payload !== "object" || !("message" in payload)) {
		return "";
	}
	return typeof payload.message === "string" ? payload.message : "";
}

// 객체 body를 실제 fetch body로 정규화합니다.
function resolveRequestBody(body: WorkClientApiRequestOptions["body"]): BodyInit | null | undefined {
	if (body === null || typeof body === "undefined") {
		return body;
	}
	if (typeof body === "string" || body instanceof FormData || body instanceof URLSearchParams || body instanceof Blob) {
		return body;
	}
	return JSON.stringify(body);
}

// 요청 본문 유형에 맞는 기본 헤더를 구성합니다.
function resolveRequestHeaders(body: WorkClientApiRequestOptions["body"], headers: HeadersInit | undefined): HeadersInit | undefined {
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

// 업무 목록 검색 파라미터를 쿼리스트링으로 변환합니다.
function toQueryString(filter: WorkListFilter): string {
	const searchParams = new URLSearchParams();
	if (typeof filter.workCompanySeq === "number" && filter.workCompanySeq > 0) {
		searchParams.set("workCompanySeq", String(filter.workCompanySeq));
	}
	if (typeof filter.workCompanyProjectSeq === "number" && filter.workCompanyProjectSeq > 0) {
		searchParams.set("workCompanyProjectSeq", String(filter.workCompanyProjectSeq));
	}
	if (typeof filter.title === "string" && filter.title.trim() !== "") {
		searchParams.set("title", filter.title.trim());
	}
	if (typeof filter.includeBodyYn === "string" && filter.includeBodyYn.trim() !== "") {
		searchParams.set("includeBodyYn", filter.includeBodyYn.trim());
	}
	if (typeof filter.sectionSize === "number" && filter.sectionSize > 0) {
		searchParams.set("sectionSize", String(filter.sectionSize));
	}
	for (const workStatCd of filter.workStatCdList ?? []) {
		if (typeof workStatCd === "string" && workStatCd.trim() !== "") {
			searchParams.append("workStatCdList", workStatCd.trim());
		}
	}
	const queryString = searchParams.toString();
	return queryString === "" ? "" : `?${queryString}`;
}

// 업무 목록 행을 기본값 기준으로 정규화합니다.
function normalizeWorkListRow(row: Partial<WorkListRow> | null | undefined): WorkListRow {
	return {
		workSeq: typeof row?.workSeq === "number" ? row.workSeq : 0,
		workCompanySeq: typeof row?.workCompanySeq === "number" ? row.workCompanySeq : 0,
		workCompanyProjectSeq: typeof row?.workCompanyProjectSeq === "number" ? row.workCompanyProjectSeq : 0,
		workStatCd: typeof row?.workStatCd === "string" ? row.workStatCd : "",
		workKey: typeof row?.workKey === "string" ? row.workKey : "",
		title: typeof row?.title === "string" ? row.title : "",
		replyCount: typeof row?.replyCount === "number" ? row.replyCount : 0,
		workCreateDt: typeof row?.workCreateDt === "string" ? row.workCreateDt : "",
		workStartDt: typeof row?.workStartDt === "string" ? row.workStartDt : "",
		workEndDt: typeof row?.workEndDt === "string" ? row.workEndDt : "",
		workTime: typeof row?.workTime === "number" ? row.workTime : null,
		workPriorCd: typeof row?.workPriorCd === "string" ? row.workPriorCd : "",
		workPriorNm: typeof row?.workPriorNm === "string" ? row.workPriorNm : "",
		itManager: typeof row?.itManager === "string" ? row.itManager : "",
		coManager: typeof row?.coManager === "string" ? row.coManager : "",
		regDt: typeof row?.regDt === "string" ? row.regDt : "",
		udtDt: typeof row?.udtDt === "string" ? row.udtDt : "",
	};
}

// 업무 상세 응답을 기본값 기준으로 정규화합니다.
function normalizeWorkDetail(detail: Partial<WorkDetail> | null | undefined): WorkDetail {
	return {
		...normalizeWorkListRow(detail),
		workCompanyNm: typeof detail?.workCompanyNm === "string" ? detail.workCompanyNm : "",
		workCompanyProjectNm: typeof detail?.workCompanyProjectNm === "string" ? detail.workCompanyProjectNm : "",
		content: typeof detail?.content === "string" ? detail.content : "",
	};
}

// 업무 첨부파일 응답을 정규화합니다.
function normalizeWorkFile(file: Partial<WorkFile> | null | undefined): WorkFile {
	return {
		workJobFileSeq: typeof file?.workJobFileSeq === "number" ? file.workJobFileSeq : 0,
		workSeq: typeof file?.workSeq === "number" ? file.workSeq : 0,
		workJobFileNm: typeof file?.workJobFileNm === "string" ? file.workJobFileNm : "",
		workJobFileUrl: typeof file?.workJobFileUrl === "string" ? file.workJobFileUrl : "",
		regDt: typeof file?.regDt === "string" ? file.regDt : "",
		udtDt: typeof file?.udtDt === "string" ? file.udtDt : "",
	};
}

// 댓글 첨부파일 응답을 정규화합니다.
function normalizeWorkReplyFile(file: Partial<WorkReplyFile> | null | undefined): WorkReplyFile {
	return {
		replyFileSeq: typeof file?.replyFileSeq === "number" ? file.replyFileSeq : 0,
		replySeq: typeof file?.replySeq === "number" ? file.replySeq : 0,
		workSeq: typeof file?.workSeq === "number" ? file.workSeq : 0,
		replyFileNm: typeof file?.replyFileNm === "string" ? file.replyFileNm : "",
		replyFileUrl: typeof file?.replyFileUrl === "string" ? file.replyFileUrl : "",
		replyFileSize: typeof file?.replyFileSize === "number" ? file.replyFileSize : null,
		regDt: typeof file?.regDt === "string" ? file.regDt : "",
		udtDt: typeof file?.udtDt === "string" ? file.udtDt : "",
	};
}

// 댓글 응답을 정규화합니다.
function normalizeWorkReply(reply: Partial<WorkReply> | null | undefined): WorkReply {
	return {
		replySeq: typeof reply?.replySeq === "number" ? reply.replySeq : 0,
		workSeq: typeof reply?.workSeq === "number" ? reply.workSeq : 0,
		replyComment: typeof reply?.replyComment === "string" ? reply.replyComment : "",
		regNo: typeof reply?.regNo === "number" ? reply.regNo : 0,
		regDt: typeof reply?.regDt === "string" ? reply.regDt : "",
		udtDt: typeof reply?.udtDt === "string" ? reply.udtDt : "",
		replyFileList: Array.isArray(reply?.replyFileList)
			? reply.replyFileList.map((fileItem) => normalizeWorkReplyFile(fileItem))
			: [],
	};
}

// bootstrap 응답의 배열 필드를 안전하게 정규화합니다.
function normalizeWorkBootstrapResponse(data: WorkBootstrapResponse): WorkBootstrapResponse {
	return {
		...data,
		companyList: resolveArrayValue(data.companyList),
		projectList: resolveArrayValue(data.projectList),
		workStatList: resolveArrayValue(data.workStatList),
		workPriorList: resolveArrayValue(data.workPriorList),
	};
}

// 목록 응답을 정규화합니다.
function normalizeWorkListResponse(data: Partial<WorkListResponse> | null | undefined): WorkListResponse {
	return {
		statusSectionList: Array.isArray(data?.statusSectionList)
			? data.statusSectionList.map((sectionItem: Partial<WorkStatusSection> | null | undefined) => {
				const normalizedList = Array.isArray(sectionItem?.list) ? sectionItem.list.map((rowItem) => normalizeWorkListRow(rowItem)) : [];
				return {
					workStatCd: typeof sectionItem?.workStatCd === "string" ? sectionItem.workStatCd : "",
					list: normalizedList,
					totalCount: typeof sectionItem?.totalCount === "number" ? sectionItem.totalCount : normalizedList.length,
					hasMore: typeof sectionItem?.hasMore === "boolean" ? sectionItem.hasMore : false,
				};
			})
			: [],
	};
}

// 상태별 추가 조회 응답을 정규화합니다.
function normalizeWorkStatusSectionPageResponse(data: Partial<WorkStatusSectionPageResponse> | null | undefined): WorkStatusSectionPageResponse {
	return {
		workStatCd: typeof data?.workStatCd === "string" ? data.workStatCd : "",
		list: Array.isArray(data?.list) ? data.list.map((rowItem) => normalizeWorkListRow(rowItem)) : [],
		totalCount: typeof data?.totalCount === "number" ? data.totalCount : 0,
		offset: typeof data?.offset === "number" ? data.offset : 0,
		limit: typeof data?.limit === "number" ? data.limit : 0,
		hasMore: Boolean(data?.hasMore),
	};
}

// 상세 응답을 정규화합니다.
function normalizeWorkDetailResponse(data: Partial<WorkDetailResponse> | null | undefined): WorkDetailResponse {
	return {
		detail: data?.detail ? normalizeWorkDetail(data.detail) : null,
		fileList: Array.isArray(data?.fileList) ? data.fileList.map((fileItem) => normalizeWorkFile(fileItem)) : [],
		replyList: Array.isArray(data?.replyList) ? data.replyList.map((replyItem) => normalizeWorkReply(replyItem)) : [],
	};
}

// 업무 댓글 multipart payload를 구성합니다.
function buildMultipartPayload(payload: object, files: File[]): FormData {
	const formData = new FormData();
	formData.append("payload", JSON.stringify(payload));
	for (const fileItem of files) {
		formData.append("files", fileItem);
	}
	return formData;
}

// 다운로드 응답 헤더에서 파일명을 추출합니다.
function resolveDownloadFileName(contentDisposition: string | undefined): string {
	if (!contentDisposition) {
		return "";
	}

	const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
	if (utf8Match?.[1]) {
		try {
			return decodeURIComponent(utf8Match[1]);
		} catch {
			return utf8Match[1];
		}
	}

	const fileNameMatch = contentDisposition.match(/filename=\"?([^\"]+)\"?/i);
	return fileNameMatch?.[1] || "";
}

// 업무관리 첨부파일 다운로드 API 응답을 Blob과 파일명으로 정리합니다.
async function downloadWorkAttachment(url: string, errorMessage: string): Promise<WorkFileDownloadData> {
	const response = await fetch(url, {
		credentials: "include",
	});
	if (!response.ok) {
		throw new Error(errorMessage);
	}
	const fileBlob = await response.blob();
	return {
		fileName: resolveDownloadFileName(response.headers.get("content-disposition") ?? undefined),
		blob: fileBlob,
	};
}

// 업무관리 공통 API 요청을 수행합니다.
export async function requestWorkClientApi<T>(
	path: string,
	{ body, headers, credentials = "include", ...restRequestInit }: WorkClientApiRequestOptions = {},
): Promise<WorkClientApiResult<T>> {
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
			message: resolveWorkClientMessage(payload),
			data: response.ok ? (payload as T) : null,
		};
	} catch (error) {
		// 취소 요청은 호출부에서 분기할 수 있도록 그대로 다시 던집니다.
		if (error instanceof DOMException && error.name === "AbortError") {
			throw error;
		}

		return {
			ok: false,
			status: 500,
			message: "",
			data: null,
		};
	}
}

// 업무관리 세션을 복구합니다.
export async function refreshWorkSession(): Promise<WorkClientApiResult<WorkSessionRefreshResponse>> {
	return requestWorkClientApi<WorkSessionRefreshResponse>("/api/work/auth/session/refresh", {
		method: "POST",
	});
}

// 업무관리 로그인을 수행합니다.
export async function loginWork(command: WorkLoginRequest): Promise<WorkClientApiResult<WorkSessionRefreshResponse>> {
	return requestWorkClientApi<WorkSessionRefreshResponse>("/api/work/auth/login", {
		method: "POST",
		body: command,
	});
}

// 업무관리 로그아웃을 수행합니다.
export async function logoutWork(): Promise<WorkClientApiResult<{ message: string }>> {
	return requestWorkClientApi<{ message: string }>("/api/work/auth/logout", {
		method: "POST",
	});
}

// 업무관리 bootstrap 데이터를 조회합니다.
export async function fetchWorkBootstrap(): Promise<WorkClientApiResult<WorkBootstrapResponse>> {
	const result = await requestWorkClientApi<WorkBootstrapResponse>("/api/work/bootstrap");
	if (!result.ok || !result.data) {
		return result;
	}
	return {
		...result,
		data: normalizeWorkBootstrapResponse(result.data),
	};
}

// 선택 회사 기준 프로젝트 목록을 조회합니다.
export async function fetchWorkProjectList(workCompanySeq: number): Promise<WorkClientApiResult<WorkProjectOption[]>> {
	return requestWorkClientApi<WorkProjectOption[]>(`/api/work/project/list?workCompanySeq=${workCompanySeq}`);
}

// 업무 목록을 조회합니다.
export async function fetchWorkList(filter: WorkListFilter): Promise<WorkClientApiResult<WorkListResponse>> {
	const result = await requestWorkClientApi<WorkListResponse>(`/api/work/list${toQueryString({
		...filter,
		sectionSize: typeof filter.sectionSize === "number" && filter.sectionSize > 0 ? filter.sectionSize : 10,
	})}`);
	if (!result.ok || !result.data) {
		return result;
	}
	return {
		...result,
		data: normalizeWorkListResponse(result.data),
	};
}

// 특정 상태의 다음 업무 목록을 추가 조회합니다.
export async function fetchWorkSectionMore(params: {
	workCompanySeq: number;
	workCompanyProjectSeq: number;
	title?: string;
	includeBodyYn?: string;
	workStatCd: string;
	offset: number;
	limit: number;
}): Promise<WorkClientApiResult<WorkStatusSectionPageResponse>> {
	const searchParams = new URLSearchParams();
	searchParams.set("workCompanySeq", String(params.workCompanySeq));
	searchParams.set("workCompanyProjectSeq", String(params.workCompanyProjectSeq));
	searchParams.set("workStatCd", params.workStatCd);
	searchParams.set("offset", String(params.offset));
	searchParams.set("limit", String(params.limit));
	if (typeof params.title === "string" && params.title.trim() !== "") {
		searchParams.set("title", params.title.trim());
	}
	if (typeof params.includeBodyYn === "string" && params.includeBodyYn.trim() !== "") {
		searchParams.set("includeBodyYn", params.includeBodyYn.trim());
	}

	const result = await requestWorkClientApi<WorkStatusSectionPageResponse>(`/api/work/list/section?${searchParams.toString()}`);
	if (!result.ok || !result.data) {
		return result;
	}
	return {
		...result,
		data: normalizeWorkStatusSectionPageResponse(result.data),
	};
}

// 업무 상세를 조회합니다.
export async function fetchWorkDetail(workSeq: number): Promise<WorkClientApiResult<WorkDetailResponse>> {
	const result = await requestWorkClientApi<WorkDetailResponse>(`/api/work/detail?workSeq=${workSeq}`);
	if (!result.ok || !result.data) {
		return result;
	}
	return {
		...result,
		data: normalizeWorkDetailResponse(result.data),
	};
}

// 업무를 수기 등록합니다.
export async function createWorkManual(
	command: WorkManualCreateRequest,
	files: File[],
): Promise<WorkClientApiResult<WorkManualCreateResponse>> {
	return requestWorkClientApi<WorkManualCreateResponse>("/api/work/manual", {
		method: "POST",
		body: buildMultipartPayload(command, files),
	});
}

// SR 업무를 가져옵니다.
export async function importWork(command: WorkImportRequest): Promise<WorkClientApiResult<WorkImportResponse>> {
	return requestWorkClientApi<WorkImportResponse>("/api/work/import", {
		method: "POST",
		body: command,
	});
}

// 업무 상세를 저장합니다.
export async function updateWorkDetail(
	command: WorkDetailUpdateRequest,
	files: File[],
): Promise<WorkClientApiResult<WorkDetailResponse>> {
	const result = await requestWorkClientApi<WorkDetailResponse>("/api/work/detail/update", {
		method: "POST",
		body: buildMultipartPayload(command, files),
	});
	if (!result.ok || !result.data) {
		return result;
	}
	return {
		...result,
		data: normalizeWorkDetailResponse(result.data),
	};
}

// 업무 첨부파일을 단건 업로드합니다.
export async function uploadWorkFile(workSeq: number, file: File): Promise<WorkClientApiResult<WorkFile>> {
	const formData = new FormData();
	formData.append("file", file);
	formData.append("workSeq", String(workSeq));

	const result = await requestWorkClientApi<WorkFile>("/api/work/file/upload", {
		method: "POST",
		body: formData,
	});
	if (!result.ok || !result.data) {
		return result;
	}
	return {
		...result,
		data: normalizeWorkFile(result.data),
	};
}

// 업무 첨부파일을 삭제합니다.
export async function deleteWorkFile(command: WorkFileDeleteRequest): Promise<WorkClientApiResult<{ message: string }>> {
	return requestWorkClientApi<{ message: string }>("/api/work/file/delete", {
		method: "POST",
		body: command,
	});
}

// 댓글을 등록합니다.
export async function createWorkReply(
	command: WorkReplySaveRequest,
	files: File[],
): Promise<WorkClientApiResult<WorkReply>> {
	const result = await requestWorkClientApi<WorkReply>("/api/work/reply", {
		method: "POST",
		body: buildMultipartPayload(command, files),
	});
	if (!result.ok || !result.data) {
		return result;
	}
	return {
		...result,
		data: normalizeWorkReply(result.data),
	};
}

// 댓글을 수정합니다.
export async function updateWorkReply(
	command: WorkReplyUpdateRequest,
	files: File[],
): Promise<WorkClientApiResult<WorkReply>> {
	const result = await requestWorkClientApi<WorkReply>("/api/work/reply/update", {
		method: "POST",
		body: buildMultipartPayload(command, files),
	});
	if (!result.ok || !result.data) {
		return result;
	}
	return {
		...result,
		data: normalizeWorkReply(result.data),
	};
}

// 댓글을 삭제합니다.
export async function deleteWorkReply(command: WorkReplyDeleteRequest): Promise<WorkClientApiResult<{ message: string }>> {
	return requestWorkClientApi<{ message: string }>("/api/work/reply/delete", {
		method: "POST",
		body: command,
	});
}

// 댓글 첨부파일을 다운로드합니다.
export async function downloadWorkReplyFile(replyFileSeq: number): Promise<WorkFileDownloadData> {
	return downloadWorkAttachment(
		`/api/work/reply/file/download?replyFileSeq=${replyFileSeq}`,
		"댓글 첨부파일 다운로드에 실패했습니다.",
	);
}

// 업무 첨부파일을 다운로드합니다.
export async function downloadWorkFile(workJobFileSeq: number): Promise<WorkFileDownloadData> {
	return downloadWorkAttachment(
		`/api/work/file/download?workJobFileSeq=${workJobFileSeq}`,
		"업무 첨부파일 다운로드에 실패했습니다.",
	);
}
