import type {
	VacationBootstrapResponse,
	VacationCompanyOption,
	VacationCreateRequest,
	VacationCreateResponse,
	VacationListFilter,
	VacationListResponse,
	VacationListRow,
	VacationPersonOption,
	VacationSummaryRow,
} from "@/components/vacation/types";
import type { WorkClientApiResult } from "@/services/workApiService";
import { requestWorkClientApi } from "@/services/workApiService";

// 배열 응답을 안전하게 정규화합니다.
function resolveArrayValue<T>(value: T[] | undefined | null): T[] {
	return Array.isArray(value) ? value : [];
}

// 문자열 값을 안전하게 정규화합니다.
function resolveStringValue(value: unknown): string {
	return typeof value === "string" ? value : "";
}

// 숫자 값을 안전하게 정규화합니다.
function resolveNumberValue(value: unknown): number {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === "string" && value.trim() !== "") {
		const parsedValue = Number(value);
		return Number.isFinite(parsedValue) ? parsedValue : 0;
	}
	return 0;
}

// 휴가관리 목록 필터를 쿼리스트링으로 변환합니다.
function toVacationListQueryString(filter: VacationListFilter): string {
	const searchParams = new URLSearchParams();
	if (typeof filter.personSeq === "number" && filter.personSeq > 0) {
		searchParams.set("personSeq", String(filter.personSeq));
	}
	if (typeof filter.workCompanySeq === "number" && filter.workCompanySeq > 0) {
		searchParams.set("workCompanySeq", String(filter.workCompanySeq));
	}
	if (typeof filter.vacationYear === "number" && filter.vacationYear > 0) {
		searchParams.set("vacationYear", String(filter.vacationYear));
	}
	if (filter.defaultCompanyYn === "Y") {
		searchParams.set("defaultCompanyYn", "Y");
	}
	const queryString = searchParams.toString();
	return queryString === "" ? "" : `?${queryString}`;
}

// 회사 선택 항목을 정규화합니다.
function normalizeVacationCompany(company: Partial<VacationCompanyOption> | null | undefined): VacationCompanyOption {
	return {
		workCompanySeq: resolveNumberValue(company?.workCompanySeq),
		workCompanyNm: resolveStringValue(company?.workCompanyNm),
		workPlatformNm: resolveStringValue(company?.workPlatformNm),
		vacationLimitCnt: resolveNumberValue(company?.vacationLimitCnt),
		dispOrd: resolveNumberValue(company?.dispOrd),
	};
}

// 휴가자 선택 항목을 정규화합니다.
function normalizeVacationPerson(person: Partial<VacationPersonOption> | null | undefined): VacationPersonOption {
	return {
		personSeq: resolveNumberValue(person?.personSeq),
		personNm: resolveStringValue(person?.personNm),
		favoriteYn: resolveStringValue(person?.favoriteYn),
		dispOrd: resolveNumberValue(person?.dispOrd),
	};
}

// 연차 사용 요약 행을 정규화합니다.
function normalizeVacationSummaryRow(row: Partial<VacationSummaryRow> | null | undefined): VacationSummaryRow {
	return {
		personSeq: resolveNumberValue(row?.personSeq),
		personNm: resolveStringValue(row?.personNm),
		workCompanySeq: resolveNumberValue(row?.workCompanySeq),
		workCompanyNm: resolveStringValue(row?.workCompanyNm),
		vacationLimitCnt: resolveNumberValue(row?.vacationLimitCnt),
		usedVacationCnt: resolveNumberValue(row?.usedVacationCnt),
		fullVacationCnt: resolveNumberValue(row?.fullVacationCnt),
		morningHalfCnt: resolveNumberValue(row?.morningHalfCnt),
		afternoonHalfCnt: resolveNumberValue(row?.afternoonHalfCnt),
		remainingVacationCnt: resolveNumberValue(row?.remainingVacationCnt),
	};
}

// 휴가 사용 목록 행을 정규화합니다.
function normalizeVacationListRow(row: Partial<VacationListRow> | null | undefined): VacationListRow {
	return {
		vacationSeq: resolveNumberValue(row?.vacationSeq),
		personSeq: resolveNumberValue(row?.personSeq),
		personNm: resolveStringValue(row?.personNm),
		workCompanySeq: resolveNumberValue(row?.workCompanySeq),
		workCompanyNm: resolveStringValue(row?.workCompanyNm),
		vacationCd: resolveStringValue(row?.vacationCd),
		vacationNm: resolveStringValue(row?.vacationNm),
		startDt: resolveStringValue(row?.startDt),
		endDt: resolveStringValue(row?.endDt),
		useDayCnt: resolveNumberValue(row?.useDayCnt),
		vacationMemo: resolveStringValue(row?.vacationMemo),
		regDt: resolveStringValue(row?.regDt),
		udtDt: resolveStringValue(row?.udtDt),
	};
}

// 휴가년도 목록을 정규화합니다.
function normalizeVacationYearList(yearList: unknown[] | null | undefined): number[] {
	return resolveArrayValue(yearList)
		.map((yearItem) => resolveNumberValue(yearItem))
		.filter((yearItem) => Number.isInteger(yearItem) && yearItem > 0);
}

// 선택된 휴가년도를 정규화합니다.
function normalizeVacationSelectedYear(value: unknown): number | null {
	const selectedYear = resolveNumberValue(value);
	return Number.isInteger(selectedYear) && selectedYear > 0 ? selectedYear : null;
}

// 선택된 회사 번호를 정규화합니다.
function normalizeSelectedWorkCompanySeq(value: unknown): number | null {
	const selectedWorkCompanySeq = resolveNumberValue(value);
	return Number.isInteger(selectedWorkCompanySeq) && selectedWorkCompanySeq > 0 ? selectedWorkCompanySeq : null;
}

// 휴가관리 bootstrap 응답을 정규화합니다.
function normalizeVacationBootstrapResponse(data: Partial<VacationBootstrapResponse> | null | undefined): VacationBootstrapResponse {
	return {
		currentUser: data?.currentUser ?? null,
		companyList: resolveArrayValue(data?.companyList).map((companyItem) => normalizeVacationCompany(companyItem)),
		personList: resolveArrayValue(data?.personList).map((personItem) => normalizeVacationPerson(personItem)),
		vacationCodeList: resolveArrayValue(data?.vacationCodeList),
	};
}

// 휴가관리 목록 응답을 정규화합니다.
function normalizeVacationListResponse(data: Partial<VacationListResponse> | null | undefined): VacationListResponse {
	return {
		selectedWorkCompanySeq: normalizeSelectedWorkCompanySeq(data?.selectedWorkCompanySeq),
		companyList: resolveArrayValue(data?.companyList).map((companyItem) => normalizeVacationCompany(companyItem)),
		yearList: normalizeVacationYearList(data?.yearList),
		selectedYear: normalizeVacationSelectedYear(data?.selectedYear),
		summaryList: resolveArrayValue(data?.summaryList).map((summaryItem) => normalizeVacationSummaryRow(summaryItem)),
		vacationList: resolveArrayValue(data?.vacationList).map((vacationItem) => normalizeVacationListRow(vacationItem)),
	};
}

// 휴가관리 bootstrap 데이터를 조회합니다.
export async function fetchVacationBootstrap(): Promise<WorkClientApiResult<VacationBootstrapResponse>> {
	const result = await requestWorkClientApi<VacationBootstrapResponse>("/api/work/vacation/bootstrap");
	if (!result.ok || !result.data) {
		return result;
	}
	return {
		...result,
		data: normalizeVacationBootstrapResponse(result.data),
	};
}

// 휴가관리 목록을 조회합니다.
export async function fetchVacationList(filter: VacationListFilter): Promise<WorkClientApiResult<VacationListResponse>> {
	const result = await requestWorkClientApi<VacationListResponse>(`/api/work/vacation/list${toVacationListQueryString(filter)}`);
	if (!result.ok || !result.data) {
		return result;
	}
	return {
		...result,
		data: normalizeVacationListResponse(result.data),
	};
}

// 휴가 사용 내역을 등록합니다.
export async function createVacation(command: VacationCreateRequest): Promise<WorkClientApiResult<VacationCreateResponse>> {
	return requestWorkClientApi<VacationCreateResponse>("/api/work/vacation", {
		method: "POST",
		body: command,
	});
}
