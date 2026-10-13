import type {
	TotalStockDailyHistoryRow,
	TotalStockCashHistoryRow,
	TotalStockCashHistoryCreateRequest,
	TotalStockCheckAmountSaveRequest,
	TotalStockHistoryAccountGroup,
	TotalStockHistoryFilter,
	TotalStockHistoryMonth,
	TotalStockHistoryResponse,
	TotalStockSaveResponse,
	TotalStockHistoryValueRow,
	TotalStockProfitGraphPoint,
} from "@/components/stock-total/types";
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

// 불리언 값을 안전하게 정규화합니다.
function resolveBooleanValue(value: unknown): boolean {
	return typeof value === "boolean" ? value : false;
}

// 월별 값 Map을 숫자 Map으로 정규화합니다.
function normalizeNumberMap(value: unknown): Record<string, number> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return {};
	}
	return Object.fromEntries(
		Object.entries(value).map(([mapKey, mapValue]) => [mapKey, resolveNumberValue(mapValue)]),
	);
}

// 주식계좌이력 검색 조건을 쿼리스트링으로 변환합니다.
function toTotalStockHistoryQueryString(filter: TotalStockHistoryFilter): string {
	const searchParams = new URLSearchParams();
	if (typeof filter.historyOffset === "number" && filter.historyOffset > 0) {
		searchParams.set("historyOffset", String(filter.historyOffset));
	}
	if (typeof filter.cashHistoryOffset === "number" && filter.cashHistoryOffset > 0) {
		searchParams.set("cashHistoryOffset", String(filter.cashHistoryOffset));
	}
	if (filter.historyViewType && filter.historyViewType !== "ALL") {
		searchParams.set("historyViewType", filter.historyViewType);
	}
	for (const accountCode of filter.stockAccountCdList ?? []) {
		if (accountCode.trim() !== "") {
			searchParams.append("stockAccountCdList", accountCode.trim());
		}
	}
	const queryString = searchParams.toString();
	return queryString === "" ? "" : `?${queryString}`;
}

// 월 컬럼 응답을 화면 기본값으로 정규화합니다.
function normalizeMonth(month: Partial<TotalStockHistoryMonth> | null | undefined): TotalStockHistoryMonth {
	return {
		monthKey: resolveStringValue(month?.monthKey),
		monthLabel: resolveStringValue(month?.monthLabel),
	};
}

// 월별 지표 행 응답을 화면 기본값으로 정규화합니다.
function normalizeValueRow(row: Partial<TotalStockHistoryValueRow> | null | undefined): TotalStockHistoryValueRow {
	return {
		rowKey: resolveStringValue(row?.rowKey),
		rowLabel: resolveStringValue(row?.rowLabel),
		valueType: resolveStringValue(row?.valueType),
		valueMap: normalizeNumberMap(row?.valueMap),
	};
}

// 계좌별 행 묶음 응답을 화면 기본값으로 정규화합니다.
function normalizeAccountGroup(group: Partial<TotalStockHistoryAccountGroup> | null | undefined): TotalStockHistoryAccountGroup {
	return {
		stockAccountCd: resolveStringValue(group?.stockAccountCd),
		stockAccountNm: resolveStringValue(group?.stockAccountNm),
		rowList: resolveArrayValue(group?.rowList).map((rowItem) => normalizeValueRow(rowItem)),
	};
}

// 확인일별 이력 행 응답을 화면 기본값으로 정규화합니다.
function normalizeDailyHistoryRow(row: Partial<TotalStockDailyHistoryRow> | null | undefined): TotalStockDailyHistoryRow {
	return {
		checkDt: resolveStringValue(row?.checkDt),
		principalAmt: resolveNumberValue(row?.principalAmt),
		checkAmt: resolveNumberValue(row?.checkAmt),
		profitAmt: resolveNumberValue(row?.profitAmt),
		profitRate: resolveNumberValue(row?.profitRate),
		previousCompareProfitAmt: resolveNumberValue(row?.previousCompareProfitAmt),
		previousCompareProfitRate: resolveNumberValue(row?.previousCompareProfitRate),
		checkAccountAmountMap: normalizeNumberMap(row?.checkAccountAmountMap),
	};
}

// 그래프 금액을 정규화하고 계산 불가 비율은 null로 유지합니다.
function normalizeProfitGraphPoint(point: Partial<TotalStockProfitGraphPoint>): TotalStockProfitGraphPoint {
	// 누락되거나 유효하지 않은 비율을 0%로 대체하지 않습니다.
	const ratio = point?.principalRatio;
	return {
		checkDt: resolveStringValue(point?.checkDt),
		principalAmt: resolveNumberValue(point?.principalAmt),
		checkAmt: resolveNumberValue(point?.checkAmt),
		principalRatio: ratio !== null && ratio !== undefined && String(ratio).trim() !== "" && Number.isFinite(Number(ratio))
			? Number(ratio) : null,
	};
}

// 입출금 이력 행 응답을 화면 기본값으로 정규화합니다.
function normalizeCashHistoryRow(row: Partial<TotalStockCashHistoryRow> | null | undefined): TotalStockCashHistoryRow {
	return {
		cashHistSeq: resolveNumberValue(row?.cashHistSeq),
		cashDt: resolveStringValue(row?.cashDt),
		stockAccountCd: resolveStringValue(row?.stockAccountCd),
		stockAccountNm: resolveStringValue(row?.stockAccountNm),
		cashInOutCd: resolveStringValue(row?.cashInOutCd),
		cashInOutNm: resolveStringValue(row?.cashInOutNm),
		cashAmt: resolveNumberValue(row?.cashAmt),
	};
}

// 주식계좌이력 응답을 화면 기본값으로 정규화합니다.
function normalizeTotalStockHistoryResponse(data: Partial<TotalStockHistoryResponse> | null | undefined): TotalStockHistoryResponse {
	return {
		monthList: resolveArrayValue(data?.monthList).map((monthItem) => normalizeMonth(monthItem)),
		summaryRowList: resolveArrayValue(data?.summaryRowList).map((rowItem) => normalizeValueRow(rowItem)),
		accountGroupList: resolveArrayValue(data?.accountGroupList).map((groupItem) => normalizeAccountGroup(groupItem)),
		historyRowList: resolveArrayValue(data?.historyRowList).map((rowItem) => normalizeDailyHistoryRow(rowItem)),
		profitGraphPointList: resolveArrayValue(data?.profitGraphPointList).map((point) => normalizeProfitGraphPoint(point)),
		historyTotalCount: resolveNumberValue(data?.historyTotalCount),
		historyPageSize: resolveNumberValue(data?.historyPageSize),
		historyHasMore: resolveBooleanValue(data?.historyHasMore),
		cashHistoryRowList: resolveArrayValue(data?.cashHistoryRowList).map((rowItem) => normalizeCashHistoryRow(rowItem)),
		cashHistoryPageSize: resolveNumberValue(data?.cashHistoryPageSize),
		cashHistoryHasMore: resolveBooleanValue(data?.cashHistoryHasMore),
	};
}

// 주식계좌이력 월별 정보와 확인일별 이력을 조회합니다.
export async function fetchTotalStockHistory(filter: TotalStockHistoryFilter): Promise<WorkClientApiResult<TotalStockHistoryResponse>> {
	const result = await requestWorkClientApi<TotalStockHistoryResponse>(`/api/work/stock-account-history${toTotalStockHistoryQueryString(filter)}`);
	if (!result.ok || !result.data) {
		return result;
	}
	return {
		...result,
		data: normalizeTotalStockHistoryResponse(result.data),
	};
}

// 계좌 확인 평가금 목록을 저장합니다.
export async function saveTotalStockCheckAmount(commandList: TotalStockCheckAmountSaveRequest[]): Promise<WorkClientApiResult<TotalStockSaveResponse>> {
	return requestWorkClientApi<TotalStockSaveResponse>("/api/work/stock-account-history/check-amount", {
		method: "POST",
		body: commandList,
	});
}

// 계좌 입출금 내역을 등록합니다.
export async function createTotalStockCashHistory(command: TotalStockCashHistoryCreateRequest): Promise<WorkClientApiResult<TotalStockSaveResponse>> {
	return requestWorkClientApi<TotalStockSaveResponse>("/api/work/stock-account-history/cash-history", {
		method: "POST",
		body: command,
	});
}

// 계좌 입출금 내역을 수정합니다.
export async function updateTotalStockCashHistory(cashHistSeq: number, command: TotalStockCashHistoryCreateRequest): Promise<WorkClientApiResult<TotalStockSaveResponse>> {
	return requestWorkClientApi<TotalStockSaveResponse>(`/api/work/stock-account-history/cash-history/${cashHistSeq}`, {
		method: "PUT",
		body: command,
	});
}
