import Head from "next/head";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, type CellClassParams, type ColDef, type ValueFormatterParams } from "ag-grid-community";
import FeedbackLayer from "@/components/common/FeedbackLayer";
import useFeedbackLayer from "@/components/common/useFeedbackLayer";
import useResizableSplitLayout from "@/components/common/useResizableSplitLayout";
import AdminDateInput from "@/components/work/AdminDateInput";
import type { StockSaleBootstrapResponse, StockSaleCreateRequest, StockSaleListResponse, StockSaleOption, StockSaleRow, StockSaleSummaryRow } from "@/components/stock-sale/types";
import { createStockSaleHistory, fetchStockSaleBootstrap, fetchStockSaleList } from "@/services/stockSaleApiService";
import { logoutWork, refreshWorkSession } from "@/services/workApiService";
import styles from "./StockSaleHistoryPage.module.css";

ModuleRegistry.registerModules([AllCommunityModule]);

const STOCK_SALE_PAGE_PATH = "/work/stock";
const STOCK_SALE_GRID_PAGE_SIZE = 20;
const STOCK_SALE_FETCH_PAGE_SIZE = 10000;
const ACCOUNT_FAVORITE_STORAGE_KEY = "react-resume:stock-sale:favorite-account-codes";
const STOCK_FAVORITE_STORAGE_KEY = "react-resume:stock-sale:favorite-stock-codes";

interface OptionButtonListProps {
	// 선택 목록 제목입니다.
	title: string;
	// 선택 가능한 옵션 목록입니다.
	optionList: StockSaleOption[];
	// 현재 선택된 코드 목록입니다.
	selectedCodeList: string[];
	// 즐겨찾기 코드 목록입니다.
	favoriteCodeSet: Set<string>;
	// 옵션 선택 토글 콜백입니다.
	onToggleSelect: (code: string) => void;
	// 즐겨찾기 토글 콜백입니다.
	onToggleFavorite: (code: string) => void;
	// 선택 해제 콜백입니다.
	onClearSelect: () => void;
}

interface StockSaleCreateFormState {
	// 매매일자입니다.
	saleDt: string;
	// 거래 계좌 코드입니다.
	stockAccountCd: string;
	// 거래 주식 코드입니다.
	stockNmCd: string;
	// 매매수 입력값입니다.
	saleCnt: string;
	// 매매금액 입력값입니다.
	saleAmt: string;
	// 손익금액 입력값입니다.
	profitAmt: string;
	// 메모 입력값입니다.
	memo: string;
}

// returnUrl을 업무 하위 경로로만 제한합니다.
function resolveSafeReturnUrl(value: string | string[] | undefined): string {
	const rawValue = Array.isArray(value) ? value[0] ?? "" : value ?? "";
	const normalizedValue = rawValue.trim();
	if (!normalizedValue.startsWith("/work")) {
		return STOCK_SALE_PAGE_PATH;
	}
	return normalizedValue;
}

// 빈 매매일지 목록 응답을 생성합니다.
function createEmptyStockSaleListResponse(): StockSaleListResponse {
	return {
		summaryList: [],
		rowList: [],
		totalCount: 0,
		pageNo: 1,
		pageSize: STOCK_SALE_GRID_PAGE_SIZE,
		totalPageCount: 0,
	};
}

// 브라우저 저장소에서 즐겨찾기 코드 목록을 읽습니다.
function readFavoriteCodeSet(storageKey: string): Set<string> {
	if (typeof window === "undefined") {
		return new Set<string>();
	}
	try {
		const storedValue = window.localStorage.getItem(storageKey);
		const parsedValue = storedValue ? JSON.parse(storedValue) : [];
		return new Set(Array.isArray(parsedValue) ? parsedValue.filter((codeItem) => typeof codeItem === "string") : []);
	} catch {
		return new Set<string>();
	}
}

// 즐겨찾기 코드 목록을 브라우저 저장소에 저장합니다.
function saveFavoriteCodeSet(storageKey: string, codeSet: Set<string>): void {
	if (typeof window === "undefined") {
		return;
	}
	window.localStorage.setItem(storageKey, JSON.stringify(Array.from(codeSet)));
}

// 코드 목록에서 특정 코드의 포함 여부를 토글합니다.
function toggleCodeListValue(codeList: string[], code: string): string[] {
	if (codeList.includes(code)) {
		return codeList.filter((codeItem) => codeItem !== code);
	}
	return [...codeList, code];
}

// 즐겨찾기 Set에서 특정 코드의 포함 여부를 토글합니다.
function toggleFavoriteCodeSet(codeSet: Set<string>, code: string): Set<string> {
	const nextCodeSet = new Set(codeSet);
	if (nextCodeSet.has(code)) {
		nextCodeSet.delete(code);
		return nextCodeSet;
	}
	nextCodeSet.add(code);
	return nextCodeSet;
}

// 옵션 목록에 즐겨찾기 상태를 반영하고 정렬합니다.
function buildSortedOptionList(optionList: StockSaleOption[], favoriteCodeSet: Set<string>): StockSaleOption[] {
	return optionList
		.map((optionItem) => ({
			...optionItem,
			favoriteYn: favoriteCodeSet.has(optionItem.cd) ? "Y" : "N",
		}))
		.sort((firstItem, secondItem) => {
			const firstFavoriteRank = firstItem.favoriteYn === "Y" ? 0 : 1;
			const secondFavoriteRank = secondItem.favoriteYn === "Y" ? 0 : 1;
			if (firstFavoriteRank !== secondFavoriteRank) {
				return firstFavoriteRank - secondFavoriteRank;
			}
			const firstDispOrd = typeof firstItem.dispOrd === "number" ? firstItem.dispOrd : Number.MAX_SAFE_INTEGER;
			const secondDispOrd = typeof secondItem.dispOrd === "number" ? secondItem.dispOrd : Number.MAX_SAFE_INTEGER;
			if (firstDispOrd !== secondDispOrd) {
				return firstDispOrd - secondDispOrd;
			}
			return firstItem.cdNm.localeCompare(secondItem.cdNm, "ko");
		});
}

// 즐겨찾기된 유효 옵션 코드만 노출 순서대로 선택 목록으로 변환합니다.
function buildSelectedFavoriteCodeList(optionList: StockSaleOption[], favoriteCodeSet: Set<string>): string[] {
	return buildSortedOptionList(optionList, favoriteCodeSet)
		.filter((optionItem) => optionItem.favoriteYn === "Y")
		.map((optionItem) => optionItem.cd);
}

// 오늘 날짜를 date input 값으로 생성합니다.
function getTodayDateInputValue(): string {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

// 문자열 숫자 입력값을 정수로 변환합니다.
function parseIntegerInputValue(value: string): number | null {
	const normalizedValue = value.trim();
	if (normalizedValue === "") {
		return null;
	}
	const parsedValue = Number(normalizedValue);
	if (!Number.isFinite(parsedValue) || !Number.isInteger(parsedValue)) {
		return null;
	}
	return parsedValue;
}

// 등록 폼 상태를 API 요청 값으로 변환합니다.
function buildStockSaleCreateRequest(formState: StockSaleCreateFormState): StockSaleCreateRequest | null {
	const saleCnt = parseIntegerInputValue(formState.saleCnt);
	const saleAmt = parseIntegerInputValue(formState.saleAmt);
	const profitAmt = parseIntegerInputValue(formState.profitAmt);
	if (formState.saleDt.trim() === "" || formState.stockAccountCd.trim() === "" || formState.stockNmCd.trim() === "" || !saleCnt || saleAmt === null || profitAmt === null) {
		return null;
	}
	return {
		saleDt: formState.saleDt,
		stockAccountCd: formState.stockAccountCd,
		stockNmCd: formState.stockNmCd,
		saleCnt,
		saleAmt,
		profitAmt,
		memo: formState.memo,
	};
}

// 금액을 천 단위 문자열로 변환합니다.
function formatNumber(value: number | null | undefined): string {
	const normalizedValue = typeof value === "number" && Number.isFinite(value) ? value : 0;
	return new Intl.NumberFormat("ko-KR").format(normalizedValue);
}

// 평균 단가를 천 단위 문자열로 변환합니다.
function formatAverageAmount(value: number | null | undefined): string {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		return "-";
	}
	return new Intl.NumberFormat("ko-KR", {
		maximumFractionDigits: 2,
	}).format(value);
}

// 금액의 양수와 음수 스타일을 구분할 수 있는 클래스명을 반환합니다.
function resolveAmountToneClassName(value: number): string {
	if (value > 0) {
		return styles.positiveAmount;
	}
	if (value < 0) {
		return styles.negativeAmount;
	}
	return "";
}

// 숫자 셀에 우측 정렬과 증감 색상 클래스를 함께 적용합니다.
function buildRightNumberCellClass(value: number | null | undefined): string[] {
	const classNameList = [styles.rightCell];
	const amountToneClassName = resolveAmountToneClassName(value ?? 0);
	if (amountToneClassName) {
		classNameList.push(amountToneClassName);
	}
	return classNameList;
}

// 종목별 합계 숫자 셀 클래스를 계산합니다.
function resolveSummaryNumberCellClass(params: CellClassParams<StockSaleSummaryRow, number | null>): string[] {
	return buildRightNumberCellClass(params.value);
}

// 상세 목록 숫자 셀 클래스를 계산합니다.
function resolveDetailNumberCellClass(params: CellClassParams<StockSaleRow, number | null>): string[] {
	return buildRightNumberCellClass(params.value);
}

// ag-grid 숫자 컬럼 값을 천 단위 문자열로 변환합니다.
function formatGridNumber(params: ValueFormatterParams<StockSaleRow, number>): string {
	return formatNumber(params.value);
}

// ag-grid 종목별 합계 숫자 컬럼 값을 천 단위 문자로 변환합니다.
function formatSummaryGridNumber(params: ValueFormatterParams<StockSaleSummaryRow, number>): string {
	return formatNumber(params.value);
}

// ag-grid 종목별 합계 평단 값을 소수점 허용 문자로 변환합니다.
function formatSummaryAverageAmount(params: ValueFormatterParams<StockSaleSummaryRow, number | null>): string {
	return formatAverageAmount(params.value);
}

// 옵션 다중 선택 버튼 목록을 렌더링합니다.
function OptionButtonList({
	title,
	optionList,
	selectedCodeList,
	favoriteCodeSet,
	onToggleSelect,
	onToggleFavorite,
	onClearSelect,
}: OptionButtonListProps) {
	return (
		<section className={styles.filterSection}>
			<div className={styles.sectionTitleRow}>
				<h2 className={styles.sectionTitle}>{title}</h2>
				<div className={styles.optionSectionActions}>
					<button type="button" className={styles.clearSelectButton} onClick={onClearSelect} disabled={selectedCodeList.length < 1}>
						선택 해제
					</button>
					<span className={styles.sectionCount}>{selectedCodeList.length}</span>
				</div>
			</div>
			<div className={styles.optionList}>
				{optionList.map((optionItem) => {
					const isSelected = selectedCodeList.includes(optionItem.cd);
					const isFavorite = favoriteCodeSet.has(optionItem.cd);
					return (
						<div key={optionItem.cd} className={`${styles.optionButtonShell} ${isSelected ? styles.optionButtonShellSelected : ""}`}>
							<button
								type="button"
								className={`${styles.favoriteButton} ${isFavorite ? styles.favoriteButtonActive : ""}`}
								onClick={() => onToggleFavorite(optionItem.cd)}
								aria-label={isFavorite ? `${optionItem.cdNm} 즐겨찾기 해제` : `${optionItem.cdNm} 즐겨찾기 추가`}
							>
								{isFavorite ? "★" : "☆"}
							</button>
							<button type="button" className={styles.optionButton} onClick={() => onToggleSelect(optionItem.cd)}>
								<span className={styles.optionLabel}>{optionItem.cdNm}</span>
							</button>
						</div>
					);
				})}
			</div>
		</section>
	);
}

// 매매일지 화면을 렌더링합니다.
export default function StockSaleHistoryPage() {
	const router = useRouter();
	const splitLayout = useResizableSplitLayout({
		defaultPrimaryWidth: 340,
		minPrimaryWidth: 300,
		maxPrimaryWidth: 860,
		maxPrimaryWidthRatio: 0.5,
		minSecondaryWidth: 420,
		collapseBreakpoint: 1024,
		primaryWidthCssVar: "--stock-sale-sidebar-width",
	});
	const { successMessage, isSuccessVisible, errorMessage, showSuccess, showError, clearError } = useFeedbackLayer();
	const [isInitializing, setIsInitializing] = useState(true);
	const [isListLoading, setIsListLoading] = useState(false);
	const [isActionPending, setIsActionPending] = useState(false);
	const [isCreateLayerOpen, setIsCreateLayerOpen] = useState(false);
	const [isCreateSaving, setIsCreateSaving] = useState(false);
	const [bootstrap, setBootstrap] = useState<StockSaleBootstrapResponse | null>(null);
	const [listResponse, setListResponse] = useState<StockSaleListResponse>(createEmptyStockSaleListResponse);
	const [startSaleDt, setStartSaleDt] = useState("");
	const [endSaleDt, setEndSaleDt] = useState("");
	const [selectedAccountCodeList, setSelectedAccountCodeList] = useState<string[]>([]);
	const [selectedStockCodeList, setSelectedStockCodeList] = useState<string[]>([]);
	const [favoriteAccountCodeSet, setFavoriteAccountCodeSet] = useState<Set<string>>(() => new Set<string>());
	const [favoriteStockCodeSet, setFavoriteStockCodeSet] = useState<Set<string>>(() => new Set<string>());
	const [showHoldingOnly, setShowHoldingOnly] = useState(true);
	const [createFormState, setCreateFormState] = useState<StockSaleCreateFormState>({
		saleDt: getTodayDateInputValue(),
		stockAccountCd: "",
		stockNmCd: "",
		saleCnt: "",
		saleAmt: "",
		profitAmt: "0",
		memo: "",
	});

	const accountOptionList = useMemo(
		() => buildSortedOptionList(bootstrap?.accountList ?? [], favoriteAccountCodeSet),
		[bootstrap?.accountList, favoriteAccountCodeSet],
	);
	const stockOptionList = useMemo(
		() => buildSortedOptionList(bootstrap?.stockList ?? [], favoriteStockCodeSet),
		[bootstrap?.stockList, favoriteStockCodeSet],
	);
	const blockingLoadingMessage = isInitializing
		? "매매일지 화면을 준비하고 있습니다."
		: isActionPending
			? "요청을 처리하고 있습니다."
			: isCreateSaving
				? "매매일지를 등록하고 있습니다."
				: isListLoading
					? "매매일지 목록을 불러오고 있습니다."
					: "";
	const totalInvestmentAmount = useMemo(
		() => listResponse.summaryList.reduce((sum, summaryItem) => sum + summaryItem.saleAmt, 0),
		[listResponse.summaryList],
	);
	const visibleSummaryList = useMemo(
		() => (showHoldingOnly ? listResponse.summaryList.filter((summaryItem) => summaryItem.saleCnt !== 0) : listResponse.summaryList),
		[listResponse.summaryList, showHoldingOnly],
	);
	const summaryColumnDefs = useMemo<ColDef<StockSaleSummaryRow>[]>(() => [
		{
			headerName: "거래주식",
			field: "stockNm",
			width: 300,
			headerClass: styles.centerHeader,
			cellClass: styles.centerCell,
			sortable: false,
		},
		{
			headerName: "주식수",
			field: "saleCnt",
			width: 80,
			type: "numericColumn",
			headerClass: styles.centerHeader,
			valueFormatter: formatSummaryGridNumber,
			cellClass: resolveSummaryNumberCellClass,
			sortable: false,
		},
		{
			headerName: "매매금액",
			field: "saleAmt",
			width: 150,
			type: "numericColumn",
			headerClass: styles.centerHeader,
			valueFormatter: formatSummaryGridNumber,
			cellClass: resolveSummaryNumberCellClass,
			sortable: false,
		},
		{
			headerName: "매매평단",
			field: "averageSaleAmt",
			width: 150,
			type: "numericColumn",
			headerClass: styles.centerHeader,
			valueFormatter: formatSummaryAverageAmount,
			cellClass: resolveSummaryNumberCellClass,
			sortable: false,
		},
		{
			headerName: "손익합계",
			field: "profitAmt",
			width: 150,
			type: "numericColumn",
			headerClass: styles.centerHeader,
			valueFormatter: formatSummaryGridNumber,
			cellClass: resolveSummaryNumberCellClass,
			sortable: false,
		},
	], []);
	const detailColumnDefs = useMemo<ColDef<StockSaleRow>[]>(() => [
		{
			headerName: "매매일시",
			field: "saleDt",
			width: 150,
			headerClass: styles.centerHeader,
			cellClass: styles.centerCell,
			sortable: false,
		},
		{
			headerName: "거래계좌",
			field: "stockAccountNm",
			width: 200,
			headerClass: styles.centerHeader,
			cellClass: styles.centerCell,
			sortable: false,
		},
		{
			headerName: "거래주식",
			field: "stockNm",
			width: 300,
			headerClass: styles.centerHeader,
			cellClass: styles.centerCell,
			sortable: false,
		},
		{
			headerName: "거래수",
			field: "saleCnt",
			width: 80,
			type: "numericColumn",
			headerClass: styles.centerHeader,
			valueFormatter: formatGridNumber,
			cellClass: resolveDetailNumberCellClass,
			sortable: false,
		},
		{
			headerName: "거래금액",
			field: "saleAmt",
			width: 150,
			type: "numericColumn",
			headerClass: styles.centerHeader,
			valueFormatter: formatGridNumber,
			cellClass: resolveDetailNumberCellClass,
			sortable: false,
		},
		{
			headerName: "손익",
			field: "profitAmt",
			width: 150,
			type: "numericColumn",
			headerClass: styles.centerHeader,
			valueFormatter: formatGridNumber,
			cellClass: resolveDetailNumberCellClass,
			sortable: false,
		},
		{
			headerName: "메모",
			field: "memo",
			width: 300,
			headerClass: styles.centerHeader,
			cellClass: styles.leftCell,
			sortable: false,
		},
	], []);

	// 검색 조건으로 목록을 조회합니다.
	const loadStockSaleList = useCallback(async (
		nextPageNo: number,
		nextStartSaleDt: string,
		nextEndSaleDt: string,
		nextAccountCodeList: string[],
		nextStockCodeList: string[],
	) => {
		setIsListLoading(true);
		try {
			const result = await fetchStockSaleList({
				startSaleDt: nextStartSaleDt,
				endSaleDt: nextEndSaleDt,
				stockAccountCdList: nextAccountCodeList,
				stockNmCdList: nextStockCodeList,
				pageNo: nextPageNo,
				pageSize: STOCK_SALE_FETCH_PAGE_SIZE,
			});
			if (!result.ok || !result.data) {
				showError(result.message || "매매일지 목록을 불러오지 못했습니다.");
				setListResponse(createEmptyStockSaleListResponse());
				return;
			}
			setListResponse(result.data);
		} finally {
			setIsListLoading(false);
		}
	}, [showError]);

	// 최초 진입 시 세션과 bootstrap 데이터를 조회합니다.
	useEffect(() => {
		let isCancelled = false;
		const initializePage = async () => {
			setIsInitializing(true);
			try {
				const sessionResult = await refreshWorkSession();
				if (!sessionResult.ok || !sessionResult.data?.authenticated) {
					await router.replace(`/work/login?returnUrl=${encodeURIComponent(resolveSafeReturnUrl(router.asPath || STOCK_SALE_PAGE_PATH))}`);
					return;
				}

				const bootstrapResult = await fetchStockSaleBootstrap();
				if (!bootstrapResult.ok || !bootstrapResult.data) {
					showError(bootstrapResult.message || "매매일지 초기 데이터를 불러오지 못했습니다.");
					return;
				}

				if (isCancelled) {
					return;
				}
				const nextFavoriteAccountCodeSet = readFavoriteCodeSet(ACCOUNT_FAVORITE_STORAGE_KEY);
				const nextFavoriteStockCodeSet = readFavoriteCodeSet(STOCK_FAVORITE_STORAGE_KEY);
				const nextSelectedAccountCodeList = buildSelectedFavoriteCodeList(bootstrapResult.data.accountList, nextFavoriteAccountCodeSet);
				const nextSelectedStockCodeList = buildSelectedFavoriteCodeList(bootstrapResult.data.stockList, nextFavoriteStockCodeSet);
				setFavoriteAccountCodeSet(nextFavoriteAccountCodeSet);
				setFavoriteStockCodeSet(nextFavoriteStockCodeSet);
				setSelectedAccountCodeList(nextSelectedAccountCodeList);
				setSelectedStockCodeList(nextSelectedStockCodeList);
				setBootstrap(bootstrapResult.data);
				await loadStockSaleList(1, "", "", nextSelectedAccountCodeList, nextSelectedStockCodeList);
			} finally {
				if (!isCancelled) {
					setIsInitializing(false);
				}
			}
		};

		void initializePage();
		return () => {
			isCancelled = true;
		};
	}, [loadStockSaleList, router, showError]);

	// 기간 검색 시작일을 갱신합니다.
	const handleStartSaleDateChange = (event: ChangeEvent<HTMLInputElement>) => {
		const nextStartSaleDt = event.target.value;
		setStartSaleDt(nextStartSaleDt);
		void loadStockSaleList(1, nextStartSaleDt, endSaleDt, selectedAccountCodeList, selectedStockCodeList);
	};

	// 기간 검색 종료일을 갱신합니다.
	const handleEndSaleDateChange = (event: ChangeEvent<HTMLInputElement>) => {
		const nextEndSaleDt = event.target.value;
		setEndSaleDt(nextEndSaleDt);
		void loadStockSaleList(1, startSaleDt, nextEndSaleDt, selectedAccountCodeList, selectedStockCodeList);
	};

	// 계좌 선택 상태를 토글합니다.
	const handleToggleAccountSelect = (code: string) => {
		const nextAccountCodeList = toggleCodeListValue(selectedAccountCodeList, code);
		setSelectedAccountCodeList(nextAccountCodeList);
		void loadStockSaleList(1, startSaleDt, endSaleDt, nextAccountCodeList, selectedStockCodeList);
	};

	// 주식 선택 상태를 토글합니다.
	const handleToggleStockSelect = (code: string) => {
		const nextStockCodeList = toggleCodeListValue(selectedStockCodeList, code);
		setSelectedStockCodeList(nextStockCodeList);
		void loadStockSaleList(1, startSaleDt, endSaleDt, selectedAccountCodeList, nextStockCodeList);
	};

	// 계좌 즐겨찾기 상태를 토글합니다.
	const handleToggleAccountFavorite = (code: string) => {
		setFavoriteAccountCodeSet((prevState) => {
			const nextState = toggleFavoriteCodeSet(prevState, code);
			saveFavoriteCodeSet(ACCOUNT_FAVORITE_STORAGE_KEY, nextState);
			return nextState;
		});
	};

	// 주식 즐겨찾기 상태를 토글합니다.
	const handleToggleStockFavorite = (code: string) => {
		setFavoriteStockCodeSet((prevState) => {
			const nextState = toggleFavoriteCodeSet(prevState, code);
			saveFavoriteCodeSet(STOCK_FAVORITE_STORAGE_KEY, nextState);
			return nextState;
		});
	};

	// 보유주식만 보기 옵션을 변경합니다.
	const handleShowHoldingOnlyChange = (event: ChangeEvent<HTMLInputElement>) => {
		setShowHoldingOnly(event.target.checked);
	};

	// 계좌 선택 조건을 해제하고 목록을 조회합니다.
	const handleClearAccountSelect = () => {
		setSelectedAccountCodeList([]);
		void loadStockSaleList(1, startSaleDt, endSaleDt, [], selectedStockCodeList);
	};

	// 주식 선택 조건을 해제하고 목록을 조회합니다.
	const handleClearStockSelect = () => {
		setSelectedStockCodeList([]);
		void loadStockSaleList(1, startSaleDt, endSaleDt, selectedAccountCodeList, []);
	};

	// 매매등록 레이어를 열고 기본 입력값을 채웁니다.
	const handleOpenCreateLayer = () => {
		setCreateFormState({
			saleDt: getTodayDateInputValue(),
			stockAccountCd: selectedAccountCodeList[0] ?? accountOptionList[0]?.cd ?? "",
			stockNmCd: selectedStockCodeList[0] ?? stockOptionList[0]?.cd ?? "",
			saleCnt: "",
			saleAmt: "",
			profitAmt: "0",
			memo: "",
		});
		setIsCreateLayerOpen(true);
	};

	// 매매등록 레이어를 닫습니다.
	const handleCloseCreateLayer = () => {
		if (isCreateSaving) {
			return;
		}
		setIsCreateLayerOpen(false);
	};

	// 매매등록 입력값을 갱신합니다.
	const handleCreateFormChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
		const { name, value } = event.target;
		setCreateFormState((prevState) => ({
			...prevState,
			[name]: value,
		}));
	};

	// 매매일지 거래 이력을 저장하고 현재 검색 조건으로 목록을 다시 조회합니다.
	const handleCreateSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const command = buildStockSaleCreateRequest(createFormState);
		if (!command) {
			showError("매매등록 입력값을 확인해주세요.");
			return;
		}

		setIsCreateSaving(true);
		try {
			const result = await createStockSaleHistory(command);
			if (!result.ok) {
				showError(result.message || "매매일지 등록에 실패했습니다.");
				return;
			}
			setIsCreateLayerOpen(false);
			showSuccess(result.data?.message || "매매일지를 등록했습니다.");
			await loadStockSaleList(1, startSaleDt, endSaleDt, selectedAccountCodeList, selectedStockCodeList);
		} finally {
			setIsCreateSaving(false);
		}
	};

	// 업무 세션을 종료하고 로그인 화면으로 이동합니다.
	const handleLogout = async () => {
		setIsActionPending(true);
		try {
			await logoutWork();
			await router.replace(`/work/login?returnUrl=${encodeURIComponent(STOCK_SALE_PAGE_PATH)}`);
		} finally {
			setIsActionPending(false);
		}
	};

	return (
		<>
			<Head>
				<title>매매일지</title>
				<meta name="description" content="react-resume 매매일지" />
			</Head>

			<div className={styles.pageShell}>
				<div ref={splitLayout.containerRef} className={styles.workspaceShell} style={splitLayout.layoutStyle}>
					<aside className={styles.sidebar}>
						<div className={styles.sidebarHeader}>
							<div>
								<p className={styles.eyebrow}>stock sale</p>
								<h1 className={styles.sidebarTitle}>매매일지</h1>
							</div>
							<p className={styles.sidebarMeta}>{bootstrap?.currentUser?.userNm || "로그인 사용자"}</p>
						</div>

						<div className={styles.filterScrollArea}>
							<section className={styles.filterSection}>
								<div className={styles.sectionTitleRow}>
									<h2 className={styles.sectionTitle}>기간검색</h2>
								</div>
								<div className={styles.dateGrid}>
									<label className={styles.fieldLabel}>
										시작일
										<AdminDateInput value={startSaleDt} onChange={handleStartSaleDateChange} />
									</label>
									<label className={styles.fieldLabel}>
										종료일
										<AdminDateInput value={endSaleDt} onChange={handleEndSaleDateChange} />
									</label>
								</div>
							</section>

							<OptionButtonList
								title="계좌"
								optionList={accountOptionList}
								selectedCodeList={selectedAccountCodeList}
								favoriteCodeSet={favoriteAccountCodeSet}
								onToggleSelect={handleToggleAccountSelect}
								onToggleFavorite={handleToggleAccountFavorite}
								onClearSelect={handleClearAccountSelect}
							/>

							<OptionButtonList
								title="주식"
								optionList={stockOptionList}
								selectedCodeList={selectedStockCodeList}
								favoriteCodeSet={favoriteStockCodeSet}
								onToggleSelect={handleToggleStockSelect}
								onToggleFavorite={handleToggleStockFavorite}
								onClearSelect={handleClearStockSelect}
							/>
						</div>

						<div className={styles.sidebarActions}>
							<button type="button" className={styles.secondaryButton} onClick={handleOpenCreateLayer} disabled={isCreateSaving}>
								매매등록
							</button>
							<button type="button" className={styles.ghostButton} onClick={handleLogout} disabled={isActionPending}>
								로그아웃
							</button>
						</div>
					</aside>

					{splitLayout.isResizeEnabled ? (
						<div
							className={`${styles.resizeHandle} ${splitLayout.isResizing ? styles.resizeHandleActive : ""}`}
							onPointerDown={splitLayout.handleResizePointerDown}
							onKeyDown={splitLayout.handleResizeKeyDown}
							role="separator"
							aria-orientation="vertical"
							aria-label="좌우 영역 너비 조절"
							aria-valuemin={splitLayout.minimumPrimaryWidth}
							aria-valuemax={splitLayout.maximumPrimaryWidth}
							aria-valuenow={splitLayout.primaryWidth}
							tabIndex={0}
						>
							<span className={styles.resizeHandleGrip} />
						</div>
					) : null}

					<main className={styles.contentPanel}>
						<section className={styles.summaryPanel}>
							<div className={styles.contentHeader}>
								<div>
									<p className={styles.eyebrow}>summary</p>
									<h2 className={styles.contentTitle}>종목별 합계</h2>
								</div>
								<div className={styles.summaryHeaderActions}>
									<p className={styles.metricValue}>{formatNumber(totalInvestmentAmount)}</p>
									<label className={styles.holdingOnlyControl}>
										<input type="checkbox" checked={showHoldingOnly} onChange={handleShowHoldingOnlyChange} />
										<span>보유주식만보기</span>
									</label>
								</div>
							</div>
							<div className={`ag-theme-quartz-dark ${styles.darkAgGrid} ${styles.summaryAgGridShell}`}>
								<AgGridReact<StockSaleSummaryRow>
									rowData={visibleSummaryList}
									columnDefs={summaryColumnDefs}
									getRowId={(params) => params.data.stockNmCd}
									theme="legacy"
									rowHeight={40}
									headerHeight={40}
									suppressCellFocus
									overlayNoRowsTemplate="검색 결과가 없습니다."
								/>
							</div>
						</section>

						<section className={styles.gridPanel}>
							<div className={styles.contentHeader}>
								<div>
									<p className={styles.eyebrow}>history</p>
									<h2 className={styles.contentTitle}>결과 리스트</h2>
								</div>
								<div className={styles.paginationControls}>
									<p className={styles.listCount}>상세 {formatNumber(listResponse.totalCount)}건</p>
								</div>
							</div>
							<div className={`ag-theme-quartz-dark ${styles.darkAgGrid} ${styles.agGridShell}`}>
								<AgGridReact<StockSaleRow>
									rowData={listResponse.rowList}
									columnDefs={detailColumnDefs}
									getRowId={(params) => String(params.data.saleHistSeq)}
									theme="legacy"
									rowHeight={42}
									headerHeight={42}
									pagination
									paginationPageSize={STOCK_SALE_GRID_PAGE_SIZE}
									paginationPageSizeSelector={[20, 50, 100]}
									suppressCellFocus
									overlayNoRowsTemplate="검색 결과가 없습니다."
								/>
							</div>
						</section>
					</main>
				</div>
			</div>

			{isCreateLayerOpen ? (
				<div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="stockSaleCreateTitle">
					<form className={styles.createModal} onSubmit={handleCreateSubmit}>
						<div className={styles.modalHeader}>
							<div>
								<p className={styles.eyebrow}>register</p>
								<h2 id="stockSaleCreateTitle" className={styles.contentTitle}>매매등록</h2>
							</div>
							<button type="button" className={styles.modalCloseButton} onClick={handleCloseCreateLayer} disabled={isCreateSaving} aria-label="매매등록 닫기">
								×
							</button>
						</div>

						<div className={styles.createFormGrid}>
							<label className={styles.fieldLabel}>
								날짜
								<AdminDateInput name="saleDt" value={createFormState.saleDt} onChange={handleCreateFormChange} disabled={isCreateSaving} />
							</label>
							<label className={styles.fieldLabel}>
								계좌
								<select name="stockAccountCd" className={styles.formControl} value={createFormState.stockAccountCd} onChange={handleCreateFormChange} disabled={isCreateSaving}>
									<option value="">선택</option>
									{accountOptionList.map((optionItem) => (
										<option key={optionItem.cd} value={optionItem.cd}>{optionItem.cdNm}</option>
									))}
								</select>
							</label>
							<label className={styles.fieldLabel}>
								주식명
								<select name="stockNmCd" className={styles.formControl} value={createFormState.stockNmCd} onChange={handleCreateFormChange} disabled={isCreateSaving}>
									<option value="">선택</option>
									{stockOptionList.map((optionItem) => (
										<option key={optionItem.cd} value={optionItem.cd}>{optionItem.cdNm}</option>
									))}
								</select>
							</label>
							<label className={styles.fieldLabel}>
								매매수
								<input name="saleCnt" className={styles.formControl} type="number" step="1" value={createFormState.saleCnt} onChange={handleCreateFormChange} disabled={isCreateSaving} />
							</label>
							<label className={styles.fieldLabel}>
								매매금액
								<input name="saleAmt" className={styles.formControl} type="number" step="1" value={createFormState.saleAmt} onChange={handleCreateFormChange} disabled={isCreateSaving} />
							</label>
							<label className={styles.fieldLabel}>
								손익금액
								<input name="profitAmt" className={styles.formControl} type="number" step="1" value={createFormState.profitAmt} onChange={handleCreateFormChange} disabled={isCreateSaving} />
							</label>
							<label className={`${styles.fieldLabel} ${styles.memoField}`}>
								메모
								<textarea name="memo" className={`${styles.formControl} ${styles.memoControl}`} value={createFormState.memo} onChange={handleCreateFormChange} disabled={isCreateSaving} maxLength={300} />
							</label>
						</div>

						<div className={styles.modalActions}>
							<button type="button" className={styles.ghostButton} onClick={handleCloseCreateLayer} disabled={isCreateSaving}>
								취소
							</button>
							<button type="submit" className={styles.secondaryButton} disabled={isCreateSaving}>
								등록
							</button>
						</div>
					</form>
				</div>
			) : null}

			<FeedbackLayer
				successMessage={successMessage}
				isSuccessVisible={isSuccessVisible}
				errorMessage={errorMessage}
				loadingVisible={isInitializing || isListLoading || isActionPending || isCreateSaving}
				loadingMessage={blockingLoadingMessage}
				onErrorClose={clearError}
			/>
		</>
	);
}
