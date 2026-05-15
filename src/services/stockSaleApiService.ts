import type {
	StockSaleBootstrapResponse,
	StockSaleCreateRequest,
	StockSaleCreateResponse,
	StockSaleListFilter,
	StockSaleListResponse,
	StockSaleOption,
	StockSaleRow,
	StockSaleSummaryRow,
} from "@/components/stock-sale/types";
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

// nullable 숫자 값을 안전하게 정규화합니다.
function resolveNullableNumberValue(value: unknown): number | null {
	if (value === null || typeof value === "undefined") {
		return null;
	}
	return resolveNumberValue(value);
}

// 매매일지 목록 검색 조건을 쿼리스트링으로 변환합니다.
function toStockSaleListQueryString(filter: StockSaleListFilter): string {
	const searchParams = new URLSearchParams();
	if (typeof filter.startSaleDt === "string" && filter.startSaleDt.trim() !== "") {
		searchParams.set("startSaleDt", filter.startSaleDt.trim());
	}
	if (typeof filter.endSaleDt === "string" && filter.endSaleDt.trim() !== "") {
		searchParams.set("endSaleDt", filter.endSaleDt.trim());
	}
	if (typeof filter.pageNo === "number" && filter.pageNo > 0) {
		searchParams.set("pageNo", String(filter.pageNo));
	}
	if (typeof filter.pageSize === "number" && filter.pageSize > 0) {
		searchParams.set("pageSize", String(filter.pageSize));
	}
	for (const accountCode of filter.stockAccountCdList ?? []) {
		if (accountCode.trim() !== "") {
			searchParams.append("stockAccountCdList", accountCode.trim());
		}
	}
	for (const stockCode of filter.stockNmCdList ?? []) {
		if (stockCode.trim() !== "") {
			searchParams.append("stockNmCdList", stockCode.trim());
		}
	}
	const queryString = searchParams.toString();
	return queryString === "" ? "" : `?${queryString}`;
}

// 선택 항목을 화면 기본값으로 정규화합니다.
function normalizeStockSaleOption(option: Partial<StockSaleOption> | null | undefined): StockSaleOption {
	return {
		grpCd: resolveStringValue(option?.grpCd),
		cd: resolveStringValue(option?.cd),
		cdNm: resolveStringValue(option?.cdNm),
		dispOrd: resolveNumberValue(option?.dispOrd),
		favoriteYn: resolveStringValue(option?.favoriteYn),
	};
}

// 종목별 합계 행을 화면 기본값으로 정규화합니다.
function normalizeStockSaleSummaryRow(row: Partial<StockSaleSummaryRow> | null | undefined): StockSaleSummaryRow {
	return {
		stockNmCd: resolveStringValue(row?.stockNmCd),
		stockNm: resolveStringValue(row?.stockNm),
		saleCnt: resolveNumberValue(row?.saleCnt),
		saleAmt: resolveNumberValue(row?.saleAmt),
		averageSaleAmt: resolveNullableNumberValue(row?.averageSaleAmt),
		profitAmt: resolveNumberValue(row?.profitAmt),
	};
}

// 매매일지 상세 행을 화면 기본값으로 정규화합니다.
function normalizeStockSaleRow(row: Partial<StockSaleRow> | null | undefined): StockSaleRow {
	return {
		saleHistSeq: resolveNumberValue(row?.saleHistSeq),
		saleDt: resolveStringValue(row?.saleDt),
		stockAccountCd: resolveStringValue(row?.stockAccountCd),
		stockAccountNm: resolveStringValue(row?.stockAccountNm),
		stockNmCd: resolveStringValue(row?.stockNmCd),
		stockNm: resolveStringValue(row?.stockNm),
		saleCnt: resolveNumberValue(row?.saleCnt),
		saleAmt: resolveNumberValue(row?.saleAmt),
		profitAmt: resolveNumberValue(row?.profitAmt),
		memo: resolveStringValue(row?.memo),
	};
}

// 매매일지 bootstrap 응답을 화면 기본값으로 정규화합니다.
function normalizeStockSaleBootstrapResponse(data: Partial<StockSaleBootstrapResponse> | null | undefined): StockSaleBootstrapResponse {
	return {
		currentUser: data?.currentUser ?? null,
		accountList: resolveArrayValue(data?.accountList).map((optionItem) => normalizeStockSaleOption(optionItem)),
		stockList: resolveArrayValue(data?.stockList).map((optionItem) => normalizeStockSaleOption(optionItem)),
	};
}

// 매매일지 목록 응답을 화면 기본값으로 정규화합니다.
function normalizeStockSaleListResponse(data: Partial<StockSaleListResponse> | null | undefined): StockSaleListResponse {
	return {
		summaryList: resolveArrayValue(data?.summaryList).map((rowItem) => normalizeStockSaleSummaryRow(rowItem)),
		rowList: resolveArrayValue(data?.rowList).map((rowItem) => normalizeStockSaleRow(rowItem)),
		totalCount: resolveNumberValue(data?.totalCount),
		pageNo: resolveNumberValue(data?.pageNo) || 1,
		pageSize: resolveNumberValue(data?.pageSize) || 20,
		totalPageCount: resolveNumberValue(data?.totalPageCount),
	};
}

// 매매일지 화면 초기 데이터를 조회합니다.
export async function fetchStockSaleBootstrap(): Promise<WorkClientApiResult<StockSaleBootstrapResponse>> {
	const result = await requestWorkClientApi<StockSaleBootstrapResponse>("/api/work/stock-sale-history/bootstrap");
	if (!result.ok || !result.data) {
		return result;
	}
	return {
		...result,
		data: normalizeStockSaleBootstrapResponse(result.data),
	};
}

// 매매일지 목록과 종목별 합계를 조회합니다.
export async function fetchStockSaleList(filter: StockSaleListFilter): Promise<WorkClientApiResult<StockSaleListResponse>> {
	const result = await requestWorkClientApi<StockSaleListResponse>(`/api/work/stock-sale-history/list${toStockSaleListQueryString(filter)}`);
	if (!result.ok || !result.data) {
		return result;
	}
	return {
		...result,
		data: normalizeStockSaleListResponse(result.data),
	};
}

// 매매일지 거래 이력을 등록합니다.
export async function createStockSaleHistory(command: StockSaleCreateRequest): Promise<WorkClientApiResult<StockSaleCreateResponse>> {
	return requestWorkClientApi<StockSaleCreateResponse>("/api/work/stock-sale-history", {
		method: "POST",
		body: command,
	});
}
