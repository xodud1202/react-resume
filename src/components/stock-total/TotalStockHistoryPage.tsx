import Head from "next/head";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ChangeEvent, type FormEvent } from "react";
import FeedbackLayer from "@/components/common/FeedbackLayer";
import useFeedbackLayer from "@/components/common/useFeedbackLayer";
import useResizableSplitLayout from "@/components/common/useResizableSplitLayout";
import type {
	TotalStockCashHistoryCreateRequest,
	TotalStockCheckAmountSaveRequest,
	TotalStockHistoryResponse,
	TotalStockHistoryValueRow,
} from "@/components/stock-total/types";
import type { StockSaleBootstrapResponse, StockSaleCreateRequest, StockSaleOption } from "@/components/stock-sale/types";
import AdminDateInput from "@/components/work/AdminDateInput";
import { createStockSaleHistory, fetchStockSaleBootstrap } from "@/services/stockSaleApiService";
import { createTotalStockCashHistory, fetchTotalStockHistory, saveTotalStockCheckAmount } from "@/services/stockAccountHistoryApiService";
import { logoutWork, refreshWorkSession } from "@/services/workApiService";
import stockStyles from "@/components/stock-sale/StockSaleHistoryPage.module.css";
import styles from "./TotalStockHistoryPage.module.css";

const TOTAL_STOCK_PAGE_PATH = "/work/totalstock";
const ACCOUNT_FAVORITE_STORAGE_KEY = "react-resume:stock-sale:favorite-account-codes";

type TotalStockTabType = "monthly" | "history";

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
	// 거래단가 입력값입니다.
	unitPrice: string;
	// 메모 입력값입니다.
	memo: string;
}

interface CheckAmountFormState {
	// 확인일입니다.
	checkDt: string;
	// 계좌별 확인 평가금 입력값 Map입니다.
	stockTotalAmtMap: Record<string, string>;
}

interface CashHistoryFormState {
	// 입출금일입니다.
	cashDt: string;
	// 입출금 계좌 코드입니다.
	stockAccountCd: string;
	// 입출금구분 코드입니다.
	cashInOutCd: string;
	// 입출금액 입력값입니다.
	cashAmt: string;
}

// 빈 주식계좌이력 응답을 생성합니다.
function createEmptyTotalStockHistoryResponse(): TotalStockHistoryResponse {
	return {
		monthList: [],
		summaryRowList: [],
		accountGroupList: [],
		historyRowList: [],
		historyTotalCount: 0,
		historyPageSize: 50,
		historyHasMore: false,
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

// 금액 입력값에서 화면 표시용 구분자를 제거합니다.
function removeAmountGroupSeparator(value: string): string {
	return value.replace(/,/g, "").trim();
}

// 문자열 숫자 입력값을 정수로 변환합니다.
function parseIntegerInputValue(value: string): number | null {
	const normalizedValue = removeAmountGroupSeparator(value);
	if (normalizedValue === "") {
		return null;
	}
	const parsedValue = Number(normalizedValue);
	if (!Number.isFinite(parsedValue) || !Number.isInteger(parsedValue)) {
		return null;
	}
	return parsedValue;
}

// 문자열 단가 입력값을 소수 허용 숫자로 변환합니다.
function parseDecimalInputValue(value: string): number | null {
	const normalizedValue = removeAmountGroupSeparator(value);
	if (normalizedValue === "" || normalizedValue === "-") {
		return null;
	}
	const parsedValue = Number(normalizedValue);
	return Number.isFinite(parsedValue) ? parsedValue : null;
}

// 금액 입력값을 천 단위 구분자가 있는 입력 문자열로 변환합니다.
function formatIntegerInputValue(value: string, allowNegative: boolean): string {
	const normalizedValue = removeAmountGroupSeparator(value);
	const isNegative = allowNegative && normalizedValue.startsWith("-");
	const unsignedValue = normalizedValue.replace(/-/g, "").replace(/\D/g, "");
	if (unsignedValue === "") {
		return isNegative ? "-" : "";
	}
	const formattedValue = new Intl.NumberFormat("ko-KR").format(Number(unsignedValue));
	return isNegative ? `-${formattedValue}` : formattedValue;
}

// 단가 입력값을 천 단위 구분자가 있는 소수 입력 문자열로 변환합니다.
function formatDecimalInputValue(value: string, allowNegative: boolean): string {
	const normalizedValue = removeAmountGroupSeparator(value);
	const isNegative = allowNegative && normalizedValue.startsWith("-");
	const unsignedValue = normalizedValue.replace(/-/g, "").replace(/[^\d.]/g, "");
	const [integerPart = "", ...decimalPartList] = unsignedValue.split(".");
	const integerDigits = integerPart.replace(/\D/g, "");
	const decimalDigits = decimalPartList.join("").replace(/\D/g, "").slice(0, 2);
	if (integerDigits === "" && decimalDigits === "") {
		return isNegative ? "-" : "";
	}
	const formattedInteger = new Intl.NumberFormat("ko-KR").format(Number(integerDigits || "0"));
	const formattedValue = unsignedValue.includes(".") ? `${formattedInteger}.${decimalDigits}` : formattedInteger;
	return isNegative ? `-${formattedValue}` : formattedValue;
}

// 거래수와 거래금액으로 거래단가 입력값을 계산합니다.
function buildUnitPriceInputValue(saleAmt: number | null, saleCnt: number | null): string {
	if (!saleAmt || !saleCnt) {
		return "";
	}
	return new Intl.NumberFormat("ko-KR", {
		maximumFractionDigits: 2,
	}).format(Math.abs(saleAmt / saleCnt));
}

// 거래수 방향에 맞춰 거래단가에서 거래금액을 계산합니다.
function calculateSaleAmountByUnitPrice(saleCnt: number | null, unitPrice: number | null): number | null {
	if (!saleCnt || saleCnt === 0 || unitPrice === null || unitPrice <= 0) {
		return null;
	}
	const sign = saleCnt < 0 ? -1 : 1;
	return Math.round(Math.abs(saleCnt) * unitPrice) * sign;
}

// 매매 폼 입력값 변경 시 거래금액과 거래단가 표시를 서로 맞춥니다.
function buildNextStockSaleFormState(prevState: StockSaleCreateFormState, name: string, value: string): StockSaleCreateFormState {
	if (name === "saleCnt") {
		const nextState = { ...prevState, saleCnt: value };
		const saleCnt = parseIntegerInputValue(value);
		const unitPrice = parseDecimalInputValue(prevState.unitPrice);
		const nextSaleAmt = calculateSaleAmountByUnitPrice(saleCnt, unitPrice);
		if (nextSaleAmt !== null) {
			return {
				...nextState,
				saleAmt: formatIntegerInputValue(String(nextSaleAmt), true),
			};
		}
		return {
			...nextState,
			unitPrice: buildUnitPriceInputValue(parseIntegerInputValue(prevState.saleAmt), saleCnt),
		};
	}
	if (name === "saleAmt") {
		const nextSaleAmt = formatIntegerInputValue(value, true);
		return {
			...prevState,
			saleAmt: nextSaleAmt,
			unitPrice: buildUnitPriceInputValue(parseIntegerInputValue(nextSaleAmt), parseIntegerInputValue(prevState.saleCnt)),
		};
	}
	if (name === "unitPrice") {
		const nextUnitPrice = formatDecimalInputValue(value, false);
		const nextSaleAmt = calculateSaleAmountByUnitPrice(parseIntegerInputValue(prevState.saleCnt), parseDecimalInputValue(nextUnitPrice));
		return {
			...prevState,
			unitPrice: nextUnitPrice,
			saleAmt: nextSaleAmt === null ? prevState.saleAmt : formatIntegerInputValue(String(nextSaleAmt), true),
		};
	}
	if (name === "saleDt" || name === "stockAccountCd" || name === "stockNmCd" || name === "memo") {
		return {
			...prevState,
			[name]: value,
		};
	}
	return prevState;
}

// 폼의 필수 입력값과 거래 방향별 금액 규칙 안내 문구를 생성합니다.
function resolveStockSaleFormValidationMessage(formState: StockSaleCreateFormState): string {
	const isSaleCntMissing = removeAmountGroupSeparator(formState.saleCnt) === "";
	const isSaleAmtMissing = removeAmountGroupSeparator(formState.saleAmt) === "";
	if (isSaleCntMissing && isSaleAmtMissing) {
		return "매매수와 매매금액을 입력해주세요.";
	}
	if (isSaleCntMissing) {
		return "매매수를 입력해주세요.";
	}
	if (isSaleAmtMissing) {
		return "매매금액을 입력해주세요.";
	}
	const saleCnt = parseIntegerInputValue(formState.saleCnt);
	const saleAmt = parseIntegerInputValue(formState.saleAmt);
	if (saleCnt === null || saleCnt === 0 || saleAmt === null || saleAmt === 0) {
		return "매매등록 입력값을 확인해주세요.";
	}
	if (saleCnt > 0 && saleAmt < 0) {
		return "매수는 양수만 입력 할 수 있습니다.";
	}
	if (saleCnt < 0 && saleAmt > 0) {
		return "매도는 음수만 입력 할 수 있습니다.";
	}
	return "";
}

// 등록 폼 상태를 API 요청 값으로 변환합니다.
function buildStockSaleCreateRequest(formState: StockSaleCreateFormState): StockSaleCreateRequest | null {
	const saleCnt = parseIntegerInputValue(formState.saleCnt);
	const saleAmt = parseIntegerInputValue(formState.saleAmt);
	if (formState.saleDt.trim() === "" || formState.stockAccountCd.trim() === "" || formState.stockNmCd.trim() === "" || !saleCnt || !saleAmt) {
		return null;
	}
	return {
		saleDt: formState.saleDt,
		stockAccountCd: formState.stockAccountCd,
		stockNmCd: formState.stockNmCd,
		saleCnt,
		saleAmt,
		profitAmt: 0,
		memo: formState.memo,
	};
}

// 계좌 확인 평가금 입력 초기 상태를 생성합니다.
function buildInitialCheckAmountFormState(accountOptionList: StockSaleOption[]): CheckAmountFormState {
	return {
		checkDt: getTodayDateInputValue(),
		stockTotalAmtMap: Object.fromEntries(accountOptionList.map((optionItem) => [optionItem.cd, ""])),
	};
}

// 계좌 확인 평가금 입력 상태를 활성 계좌 전체 API 요청 목록으로 변환합니다.
function buildCheckAmountSaveRequestList(
	formState: CheckAmountFormState,
	accountOptionList: StockSaleOption[],
): TotalStockCheckAmountSaveRequest[] | null {
	if (formState.checkDt.trim() === "" || accountOptionList.length === 0) {
		return null;
	}
	const requestList: TotalStockCheckAmountSaveRequest[] = [];
	for (const accountOption of accountOptionList) {
		const stockTotalAmt = parseIntegerInputValue(formState.stockTotalAmtMap[accountOption.cd] ?? "");
		if (stockTotalAmt === null || stockTotalAmt < 0) {
			return null;
		}
		requestList.push({
			checkDt: formState.checkDt,
			stockAccountCd: accountOption.cd,
			stockTotalAmt,
		});
	}
	return requestList;
}

// 계좌 입출금 입력 상태를 API 요청 값으로 변환합니다.
function buildCashHistoryCreateRequest(formState: CashHistoryFormState): TotalStockCashHistoryCreateRequest | null {
	const cashAmt = parseIntegerInputValue(formState.cashAmt);
	if (formState.cashDt.trim() === "" || formState.stockAccountCd.trim() === "" || formState.cashInOutCd.trim() === "" || cashAmt === null || cashAmt <= 0) {
		return null;
	}
	return {
		cashDt: formState.cashDt,
		stockAccountCd: formState.stockAccountCd,
		cashInOutCd: formState.cashInOutCd,
		cashAmt,
	};
}

// 금액을 천 단위 문자열로 변환합니다.
function formatNumber(value: number | null | undefined): string {
	const normalizedValue = typeof value === "number" && Number.isFinite(value) ? value : 0;
	return new Intl.NumberFormat("ko-KR").format(normalizedValue);
}

// 수익률 값을 퍼센트 문자열로 변환합니다.
function formatRate(value: number | null | undefined): string {
	const normalizedValue = typeof value === "number" && Number.isFinite(value) ? value : 0;
	return `${new Intl.NumberFormat("ko-KR", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(normalizedValue)}%`;
}

// 월별 행 값의 증가/감소 스타일을 반환합니다.
function resolveValueToneClassName(row: TotalStockHistoryValueRow, value: number): string {
	if (!row.rowKey.toLowerCase().includes("profit")) {
		return "";
	}
	if (value > 0) {
		return stockStyles.positiveAmount;
	}
	if (value < 0) {
		return stockStyles.negativeAmount;
	}
	return "";
}

// 강조 대상 월별 행의 클래스명을 반환합니다.
function resolveMonthlyRowClassName(rowKey: string): string {
	if (["principalAmt", "checkAmt", "profitAmt", "profitRate"].includes(rowKey) || rowKey.startsWith("total")) {
		return styles.emphasisRow;
	}
	return "";
}

// 월별 값 행을 화면 문자열로 변환합니다.
function formatMonthlyRowValue(row: TotalStockHistoryValueRow, monthKey: string): string {
	const value = row.valueMap[monthKey] ?? 0;
	return row.valueType === "RATE" ? formatRate(value) : formatNumber(value);
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
		<section className={stockStyles.filterSection}>
			<div className={stockStyles.sectionTitleRow}>
				<h2 className={stockStyles.sectionTitle}>{title}</h2>
				<div className={stockStyles.optionSectionActions}>
					<span className={stockStyles.sectionCount}>{selectedCodeList.length}</span>
					<button type="button" className={stockStyles.clearSelectButton} onClick={onClearSelect} disabled={selectedCodeList.length === 0}>
						선택해제
					</button>
				</div>
			</div>
			<div className={stockStyles.optionList}>
				{optionList.length > 0 ? (
					optionList.map((optionItem) => {
						const isSelected = selectedCodeList.includes(optionItem.cd);
						const isFavorite = favoriteCodeSet.has(optionItem.cd);
						return (
							<div
								key={optionItem.cd}
								className={`${stockStyles.optionButtonShell} ${isSelected ? stockStyles.optionButtonShellSelected : ""}`}
							>
								<button
									type="button"
									className={`${stockStyles.favoriteButton} ${isFavorite ? stockStyles.favoriteButtonActive : ""}`}
									onClick={() => onToggleFavorite(optionItem.cd)}
									aria-label={`${optionItem.cdNm} 즐겨찾기`}
									aria-pressed={isFavorite}
								>
									★
								</button>
								<button
									type="button"
									className={stockStyles.optionButton}
									onClick={() => onToggleSelect(optionItem.cd)}
									aria-pressed={isSelected}
								>
									<span className={stockStyles.optionLabel}>{optionItem.cdNm}</span>
								</button>
							</div>
						);
					})
				) : (
					<p className={stockStyles.emptyText}>계좌가 없습니다.</p>
				)}
			</div>
		</section>
	);
}

// 주식계좌이력 화면을 렌더링합니다.
export default function TotalStockHistoryPage() {
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
	const [isCheckAmountLayerOpen, setIsCheckAmountLayerOpen] = useState(false);
	const [isCheckAmountSaving, setIsCheckAmountSaving] = useState(false);
	const [isCashHistoryLayerOpen, setIsCashHistoryLayerOpen] = useState(false);
	const [isCashHistorySaving, setIsCashHistorySaving] = useState(false);
	const [activeTab, setActiveTab] = useState<TotalStockTabType>("monthly");
	const [bootstrap, setBootstrap] = useState<StockSaleBootstrapResponse | null>(null);
	const [historyResponse, setHistoryResponse] = useState<TotalStockHistoryResponse>(createEmptyTotalStockHistoryResponse);
	const [selectedAccountCodeList, setSelectedAccountCodeList] = useState<string[]>([]);
	const [favoriteAccountCodeSet, setFavoriteAccountCodeSet] = useState<Set<string>>(() => new Set<string>());
	const [createFormState, setCreateFormState] = useState<StockSaleCreateFormState>({
		saleDt: getTodayDateInputValue(),
		stockAccountCd: "",
		stockNmCd: "",
		saleCnt: "",
		saleAmt: "",
		unitPrice: "",
		memo: "",
	});
	const [checkAmountFormState, setCheckAmountFormState] = useState<CheckAmountFormState>({
		checkDt: getTodayDateInputValue(),
		stockTotalAmtMap: {},
	});
	const [cashHistoryFormState, setCashHistoryFormState] = useState<CashHistoryFormState>({
		cashDt: getTodayDateInputValue(),
		stockAccountCd: "",
		cashInOutCd: "",
		cashAmt: "",
	});

	const accountOptionList = useMemo(
		() => buildSortedOptionList(bootstrap?.accountList ?? [], favoriteAccountCodeSet),
		[bootstrap?.accountList, favoriteAccountCodeSet],
	);
	const stockOptionList = useMemo(
		() => buildSortedOptionList(bootstrap?.stockList ?? [], new Set<string>()),
		[bootstrap?.stockList],
	);
	const cashInOutOptionList = useMemo(
		() => buildSortedOptionList(bootstrap?.cashInOutList ?? [], new Set<string>()),
		[bootstrap?.cashInOutList],
	);
	const blockingLoadingMessage = isInitializing
		? "주식계좌이력 화면을 준비하고 있습니다."
		: isCheckAmountSaving
			? "계좌확인금액을 저장하고 있습니다."
			: isCashHistorySaving
				? "입출금 내역을 등록하고 있습니다."
		: isCreateSaving
			? "매매일지를 등록하고 있습니다."
			: "주식계좌이력을 조회하고 있습니다.";

	// 선택 계좌 조건으로 주식계좌이력을 조회합니다.
	const loadTotalStockHistory = useCallback(async (
		nextAccountCodeList: string[],
		historyOffset: number,
		appendHistory: boolean,
	) => {
		setIsListLoading(true);
		try {
			const result = await fetchTotalStockHistory({
				stockAccountCdList: nextAccountCodeList,
				historyOffset,
			});
			if (!result.ok || !result.data) {
				if (result.status === 401 || result.status === 403) {
					await router.replace(`/work/login?returnUrl=${encodeURIComponent(TOTAL_STOCK_PAGE_PATH)}`);
					return;
				}
				showError(result.message || "주식계좌이력 조회에 실패했습니다.");
				return;
			}

			const nextHistoryResponse = result.data;
			setHistoryResponse((prevState) => {
				if (!appendHistory) {
					return nextHistoryResponse;
				}
				return {
					...nextHistoryResponse,
					historyRowList: [...prevState.historyRowList, ...nextHistoryResponse.historyRowList],
				};
			});
		} finally {
			setIsListLoading(false);
		}
	}, [router, showError]);

	// 최초 진입 시 세션과 bootstrap 데이터를 조회합니다.
	useEffect(() => {
		let isCancelled = false;
		const initializePage = async () => {
			setIsInitializing(true);
			try {
				const sessionResult = await refreshWorkSession();
				if (!sessionResult.ok || !sessionResult.data?.authenticated) {
					await router.replace(`/work/login?returnUrl=${encodeURIComponent(TOTAL_STOCK_PAGE_PATH)}`);
					return;
				}

				const bootstrapResult = await fetchStockSaleBootstrap();
				if (!bootstrapResult.ok || !bootstrapResult.data) {
					showError(bootstrapResult.message || "주식계좌이력 초기 데이터 조회에 실패했습니다.");
					return;
				}
				if (isCancelled) {
					return;
				}

				const nextFavoriteAccountCodeSet = readFavoriteCodeSet(ACCOUNT_FAVORITE_STORAGE_KEY);
				const nextSelectedAccountCodeList = buildSelectedFavoriteCodeList(bootstrapResult.data.accountList, nextFavoriteAccountCodeSet);
				setFavoriteAccountCodeSet(nextFavoriteAccountCodeSet);
				setSelectedAccountCodeList(nextSelectedAccountCodeList);
				setBootstrap(bootstrapResult.data);
				await loadTotalStockHistory(nextSelectedAccountCodeList, 0, false);
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
	}, [loadTotalStockHistory, router, showError]);

	// 계좌 선택 상태를 토글합니다.
	const handleToggleAccountSelect = (code: string) => {
		const nextAccountCodeList = toggleCodeListValue(selectedAccountCodeList, code);
		setSelectedAccountCodeList(nextAccountCodeList);
		void loadTotalStockHistory(nextAccountCodeList, 0, false);
	};

	// 계좌 즐겨찾기 상태를 토글합니다.
	const handleToggleAccountFavorite = (code: string) => {
		setFavoriteAccountCodeSet((prevState) => {
			const nextState = toggleFavoriteCodeSet(prevState, code);
			saveFavoriteCodeSet(ACCOUNT_FAVORITE_STORAGE_KEY, nextState);
			return nextState;
		});
	};

	// 계좌 선택 조건을 해제하고 목록을 조회합니다.
	const handleClearAccountSelect = () => {
		setSelectedAccountCodeList([]);
		void loadTotalStockHistory([], 0, false);
	};

	// 더보기 버튼으로 확인일별 이력을 추가 조회합니다.
	const handleLoadMoreHistory = () => {
		void loadTotalStockHistory(selectedAccountCodeList, historyResponse.historyRowList.length, true);
	};

	// 매매일지 화면으로 이동합니다.
	const handleMoveStockSalePage = () => {
		void router.push("/work/stock");
	};

	// 계좌확인금액입력 레이어를 열고 기본 입력값을 채웁니다.
	const handleOpenCheckAmountLayer = () => {
		setCheckAmountFormState(buildInitialCheckAmountFormState(accountOptionList));
		setIsCheckAmountLayerOpen(true);
	};

	// 계좌확인금액입력 레이어를 닫습니다.
	const handleCloseCheckAmountLayer = () => {
		if (isCheckAmountSaving) {
			return;
		}
		setIsCheckAmountLayerOpen(false);
	};

	// 계좌확인금액입력 날짜를 갱신합니다.
	const handleCheckAmountDateChange = (event: ChangeEvent<HTMLInputElement>) => {
		setCheckAmountFormState((prevState) => ({
			...prevState,
			checkDt: event.target.value,
		}));
	};

	// 계좌별 확인금액 입력값을 갱신합니다.
	const handleCheckAmountValueChange = (event: ChangeEvent<HTMLInputElement>) => {
		const accountCode = event.target.dataset.accountCode ?? "";
		const { value } = event.target;
		if (accountCode === "") {
			return;
		}
		setCheckAmountFormState((prevState) => ({
			...prevState,
			stockTotalAmtMap: {
				...prevState.stockTotalAmtMap,
				[accountCode]: formatIntegerInputValue(value, false),
			},
		}));
	};

	// 계좌확인금액을 저장하고 주식계좌이력을 다시 조회합니다.
	const handleCheckAmountSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const commandList = buildCheckAmountSaveRequestList(checkAmountFormState, accountOptionList);
		if (!commandList) {
			showError("계좌확인금액 입력값을 확인해주세요.");
			return;
		}

		setIsCheckAmountSaving(true);
		try {
			const result = await saveTotalStockCheckAmount(commandList);
			if (!result.ok) {
				showError(result.message || "계좌확인금액 저장에 실패했습니다.");
				return;
			}
			setIsCheckAmountLayerOpen(false);
			showSuccess(result.data?.message || "계좌확인금액을 저장했습니다.");
			await loadTotalStockHistory(selectedAccountCodeList, 0, false);
		} finally {
			setIsCheckAmountSaving(false);
		}
	};

	// 입출금 등록 레이어를 열고 기본 입력값을 채웁니다.
	const handleOpenCashHistoryLayer = () => {
		setCashHistoryFormState({
			cashDt: getTodayDateInputValue(),
			stockAccountCd: selectedAccountCodeList[0] ?? accountOptionList[0]?.cd ?? "",
			cashInOutCd: cashInOutOptionList[0]?.cd ?? "",
			cashAmt: "",
		});
		setIsCashHistoryLayerOpen(true);
	};

	// 입출금 등록 레이어를 닫습니다.
	const handleCloseCashHistoryLayer = () => {
		if (isCashHistorySaving) {
			return;
		}
		setIsCashHistoryLayerOpen(false);
	};

	// 입출금 등록 입력값을 갱신합니다.
	const handleCashHistoryFormChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
		const { name, value } = event.target;
		setCashHistoryFormState((prevState) => ({
			...prevState,
			[name]: name === "cashAmt" ? formatIntegerInputValue(value, false) : value,
		}));
	};

	// 입출금 내역을 등록하고 주식계좌이력을 다시 조회합니다.
	const handleCashHistorySubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const command = buildCashHistoryCreateRequest(cashHistoryFormState);
		if (!command) {
			showError("입출금 등록 입력값을 확인해주세요.");
			return;
		}

		setIsCashHistorySaving(true);
		try {
			const result = await createTotalStockCashHistory(command);
			if (!result.ok) {
				showError(result.message || "입출금 내역 등록에 실패했습니다.");
				return;
			}
			setIsCashHistoryLayerOpen(false);
			showSuccess(result.data?.message || "입출금 내역을 등록했습니다.");
			await loadTotalStockHistory(selectedAccountCodeList, 0, false);
		} finally {
			setIsCashHistorySaving(false);
		}
	};

	// 매매등록 레이어를 열고 기본 입력값을 채웁니다.
	const handleOpenCreateLayer = () => {
		setCreateFormState({
			saleDt: getTodayDateInputValue(),
			stockAccountCd: selectedAccountCodeList[0] ?? accountOptionList[0]?.cd ?? "",
			stockNmCd: stockOptionList[0]?.cd ?? "",
			saleCnt: "",
			saleAmt: "",
			unitPrice: "",
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
		setCreateFormState((prevState) => buildNextStockSaleFormState(prevState, name, value));
	};

	// 매매일지 거래 이력을 저장하고 주식계좌이력을 다시 조회합니다.
	const handleCreateSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const requiredMessage = resolveStockSaleFormValidationMessage(createFormState);
		if (requiredMessage !== "") {
			showError(requiredMessage);
			return;
		}

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
			await loadTotalStockHistory(selectedAccountCodeList, 0, false);
		} finally {
			setIsCreateSaving(false);
		}
	};

	// 업무 세션을 종료하고 로그인 화면으로 이동합니다.
	const handleLogout = async () => {
		setIsActionPending(true);
		try {
			await logoutWork();
			await router.replace(`/work/login?returnUrl=${encodeURIComponent(TOTAL_STOCK_PAGE_PATH)}`);
		} finally {
			setIsActionPending(false);
		}
	};

	return (
		<>
			<Head>
				<title>주식계좌이력</title>
				<meta name="description" content="react-resume 주식계좌이력" />
			</Head>

			<div className={stockStyles.pageShell}>
				<div ref={splitLayout.containerRef} className={stockStyles.workspaceShell} style={splitLayout.layoutStyle}>
					<aside className={stockStyles.sidebar}>
						<div className={stockStyles.sidebarHeader}>
							<div>
								<p className={stockStyles.eyebrow}>stock account</p>
								<h1 className={stockStyles.sidebarTitle}>주식계좌이력</h1>
							</div>
							<div className={stockStyles.sidebarMetaActions}>
								<p className={stockStyles.sidebarMeta}>{bootstrap?.currentUser?.userNm || "로그인 사용자"}</p>
							</div>
						</div>

						<div className={stockStyles.filterScrollArea}>
							<OptionButtonList
								title="계좌"
								optionList={accountOptionList}
								selectedCodeList={selectedAccountCodeList}
								favoriteCodeSet={favoriteAccountCodeSet}
								onToggleSelect={handleToggleAccountSelect}
								onToggleFavorite={handleToggleAccountFavorite}
								onClearSelect={handleClearAccountSelect}
							/>
						</div>

						<div className={stockStyles.sidebarActions}>
							<button type="button" className={stockStyles.secondaryButton} onClick={handleOpenCheckAmountLayer} disabled={isCheckAmountSaving}>
								계좌확인금액입력
							</button>
							<button type="button" className={stockStyles.secondaryButton} onClick={handleOpenCashHistoryLayer} disabled={isCashHistorySaving}>
								입출금 등록
							</button>
							<button type="button" className={stockStyles.secondaryButton} onClick={handleOpenCreateLayer} disabled={isCreateSaving}>
								매매등록
							</button>
							<button type="button" className={stockStyles.ghostButton} onClick={handleLogout} disabled={isActionPending}>
								로그아웃
							</button>
						</div>
					</aside>

					{splitLayout.isResizeEnabled ? (
						<div
							className={`${stockStyles.resizeHandle} ${splitLayout.isResizing ? stockStyles.resizeHandleActive : ""}`}
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
							<span className={stockStyles.resizeHandleGrip} />
						</div>
					) : null}

					<main className={stockStyles.contentPanel}>
						<section className={`${stockStyles.gridPanel} ${styles.contentPanel}`}>
							<div className={stockStyles.contentHeader}>
								<div>
									<p className={stockStyles.eyebrow}>account history</p>
									<h2 className={stockStyles.contentTitle}>주식계좌이력 정보</h2>
								</div>
								<button type="button" className={stockStyles.secondaryButton} onClick={handleMoveStockSalePage}>
									매매일지
								</button>
							</div>

							<div className={styles.tabBar} role="tablist" aria-label="주식계좌이력 탭">
								<button
									type="button"
									className={`${styles.tabButton} ${activeTab === "monthly" ? styles.tabButtonActive : ""}`}
									onClick={() => setActiveTab("monthly")}
									role="tab"
									aria-selected={activeTab === "monthly"}
								>
									월별 정보
								</button>
								<button
									type="button"
									className={`${styles.tabButton} ${activeTab === "history" ? styles.tabButtonActive : ""}`}
									onClick={() => setActiveTab("history")}
									role="tab"
									aria-selected={activeTab === "history"}
								>
									계좌별 전체 이력 정보
								</button>
							</div>

							{activeTab === "monthly" ? (
								<div className={styles.monthlyScrollShell}>
									<table className={styles.monthlyTable} style={{ "--month-count": historyResponse.monthList.length } as CSSProperties}>
										<thead>
											<tr>
												<th className={`${styles.groupHeaderCell} ${styles.stickyGroupCell}`}>계좌</th>
												<th className={`${styles.labelHeaderCell} ${styles.stickyLabelCell}`}>항목</th>
												{historyResponse.monthList.map((monthItem) => (
													<th key={monthItem.monthKey} className={styles.monthHeaderCell}>{monthItem.monthLabel}</th>
												))}
											</tr>
										</thead>
										<tbody>
											{historyResponse.summaryRowList.map((rowItem, rowIndex) => (
												<tr key={rowItem.rowKey} className={`${styles.summaryRow} ${resolveMonthlyRowClassName(rowItem.rowKey)}`}>
													{rowIndex === 0 ? (
														<th rowSpan={historyResponse.summaryRowList.length} className={`${styles.groupCell} ${styles.summaryGroupCell} ${styles.stickyGroupCell}`}>
															전체
														</th>
													) : null}
													<th className={`${styles.labelCell} ${styles.stickyLabelCell}`}>{rowItem.rowLabel}</th>
													{historyResponse.monthList.map((monthItem) => {
														const value = rowItem.valueMap[monthItem.monthKey] ?? 0;
														return (
															<td key={monthItem.monthKey} className={`${styles.valueCell} ${resolveValueToneClassName(rowItem, value)}`}>
																{formatMonthlyRowValue(rowItem, monthItem.monthKey)}
															</td>
														);
													})}
												</tr>
											))}
											{historyResponse.accountGroupList.map((accountGroup) => (
												accountGroup.rowList.map((rowItem, rowIndex) => (
													<tr key={`${accountGroup.stockAccountCd}-${rowItem.rowKey}`} className={resolveMonthlyRowClassName(rowItem.rowKey)}>
														{rowIndex === 0 ? (
															<th rowSpan={accountGroup.rowList.length} className={`${styles.groupCell} ${styles.stickyGroupCell}`}>
																{accountGroup.stockAccountNm}
															</th>
														) : null}
														<th className={`${styles.labelCell} ${styles.stickyLabelCell}`}>{rowItem.rowLabel}</th>
														{historyResponse.monthList.map((monthItem) => {
															const value = rowItem.valueMap[monthItem.monthKey] ?? 0;
															return (
																<td key={monthItem.monthKey} className={`${styles.valueCell} ${resolveValueToneClassName(rowItem, value)}`}>
																	{formatMonthlyRowValue(rowItem, monthItem.monthKey)}
																</td>
															);
														})}
													</tr>
												))
											))}
											{historyResponse.summaryRowList.length === 0 && historyResponse.accountGroupList.length === 0 ? (
												<tr>
													<td className={styles.emptyTableCell} colSpan={Math.max(2, historyResponse.monthList.length + 2)}>
														조회 결과가 없습니다.
													</td>
												</tr>
											) : null}
										</tbody>
									</table>
								</div>
							) : (
								<div className={styles.historyTableShell}>
									<table className={styles.historyTable}>
										<thead>
											<tr>
												<th>확인일</th>
												<th>계좌 총원금액</th>
												<th>월중확인평가금</th>
												<th>원금대비 손익금</th>
												<th>원금대비 손익율</th>
											</tr>
										</thead>
										<tbody>
											{historyResponse.historyRowList.map((historyRow) => (
												<tr key={historyRow.checkDt}>
													<th>{historyRow.checkDt}</th>
													<td>{formatNumber(historyRow.principalAmt)}</td>
													<td>{formatNumber(historyRow.checkAmt)}</td>
													<td className={historyRow.profitAmt > 0 ? stockStyles.positiveAmount : historyRow.profitAmt < 0 ? stockStyles.negativeAmount : ""}>
														{formatNumber(historyRow.profitAmt)}
													</td>
													<td className={historyRow.profitRate > 0 ? stockStyles.positiveAmount : historyRow.profitRate < 0 ? stockStyles.negativeAmount : ""}>
														{formatRate(historyRow.profitRate)}
													</td>
												</tr>
											))}
											{historyResponse.historyRowList.length === 0 ? (
												<tr>
													<td className={styles.emptyTableCell} colSpan={5}>
														조회 결과가 없습니다.
													</td>
												</tr>
											) : null}
										</tbody>
									</table>
									{historyResponse.historyHasMore ? (
										<div className={styles.moreButtonRow}>
											<button type="button" className={stockStyles.pageButton} onClick={handleLoadMoreHistory} disabled={isListLoading}>
												더보기
											</button>
										</div>
									) : null}
								</div>
							)}
						</section>
					</main>
				</div>
			</div>

			{isCheckAmountLayerOpen ? (
				<div className={stockStyles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="totalStockCheckAmountTitle">
					<form className={stockStyles.createModal} onSubmit={handleCheckAmountSubmit}>
						<div className={stockStyles.modalHeader}>
							<div>
								<p className={stockStyles.eyebrow}>stock check</p>
								<h2 id="totalStockCheckAmountTitle" className={stockStyles.contentTitle}>계좌확인금액입력</h2>
							</div>
							<button type="button" className={stockStyles.modalCloseButton} onClick={handleCloseCheckAmountLayer} disabled={isCheckAmountSaving} aria-label="계좌확인금액입력 닫기">
								×
							</button>
						</div>

						<div className={`${stockStyles.createFormGrid} ${styles.checkAmountFormGrid}`}>
							<label className={`${stockStyles.fieldLabel} ${styles.checkAmountDateField}`}>
								확인일
								<AdminDateInput name="checkDt" value={checkAmountFormState.checkDt} onChange={handleCheckAmountDateChange} disabled={isCheckAmountSaving} />
							</label>
							<div className={styles.checkAmountEntryShell}>
								<div className={styles.checkAmountEntryHeader}>
									<span>계좌</span>
									<span>확인금액</span>
								</div>
								{accountOptionList.length > 0 ? (
									accountOptionList.map((optionItem) => (
										<label key={optionItem.cd} className={styles.checkAmountEntryRow}>
											<span className={styles.checkAmountAccountName}>{optionItem.cdNm}</span>
											<input
												name="stockTotalAmt"
												className={stockStyles.formControl}
												type="text"
												inputMode="numeric"
												value={checkAmountFormState.stockTotalAmtMap[optionItem.cd] ?? ""}
												data-account-code={optionItem.cd}
												onChange={handleCheckAmountValueChange}
												disabled={isCheckAmountSaving}
											/>
										</label>
									))
								) : (
									<p className={styles.checkAmountEmptyText}>사용 중인 계좌가 없습니다.</p>
								)}
							</div>
						</div>

						<div className={stockStyles.modalActions}>
							<button type="button" className={stockStyles.ghostButton} onClick={handleCloseCheckAmountLayer} disabled={isCheckAmountSaving}>
								취소
							</button>
							<button type="submit" className={stockStyles.secondaryButton} disabled={isCheckAmountSaving}>
								저장
							</button>
						</div>
					</form>
				</div>
			) : null}

			{isCashHistoryLayerOpen ? (
				<div className={stockStyles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="totalStockCashHistoryTitle">
					<form className={stockStyles.createModal} onSubmit={handleCashHistorySubmit}>
						<div className={stockStyles.modalHeader}>
							<div>
								<p className={stockStyles.eyebrow}>cash history</p>
								<h2 id="totalStockCashHistoryTitle" className={stockStyles.contentTitle}>입출금 등록</h2>
							</div>
							<button type="button" className={stockStyles.modalCloseButton} onClick={handleCloseCashHistoryLayer} disabled={isCashHistorySaving} aria-label="입출금 등록 닫기">
								×
							</button>
						</div>

						<div className={stockStyles.createFormGrid}>
							<label className={stockStyles.fieldLabel}>
								입출금일
								<AdminDateInput name="cashDt" value={cashHistoryFormState.cashDt} onChange={handleCashHistoryFormChange} disabled={isCashHistorySaving} />
							</label>
							<label className={stockStyles.fieldLabel}>
								계좌
								<select name="stockAccountCd" className={stockStyles.formControl} value={cashHistoryFormState.stockAccountCd} onChange={handleCashHistoryFormChange} disabled={isCashHistorySaving}>
									<option value="">선택</option>
									{accountOptionList.map((optionItem) => (
										<option key={optionItem.cd} value={optionItem.cd}>{optionItem.cdNm}</option>
									))}
								</select>
							</label>
							<label className={stockStyles.fieldLabel}>
								입출금구분
								<select name="cashInOutCd" className={stockStyles.formControl} value={cashHistoryFormState.cashInOutCd} onChange={handleCashHistoryFormChange} disabled={isCashHistorySaving}>
									<option value="">선택</option>
									{cashInOutOptionList.map((optionItem) => (
										<option key={optionItem.cd} value={optionItem.cd}>{optionItem.cdNm}</option>
									))}
								</select>
							</label>
							<label className={stockStyles.fieldLabel}>
								입출금액
								<input name="cashAmt" className={stockStyles.formControl} type="text" inputMode="numeric" value={cashHistoryFormState.cashAmt} onChange={handleCashHistoryFormChange} disabled={isCashHistorySaving} />
							</label>
						</div>

						<div className={stockStyles.modalActions}>
							<button type="button" className={stockStyles.ghostButton} onClick={handleCloseCashHistoryLayer} disabled={isCashHistorySaving}>
								취소
							</button>
							<button type="submit" className={stockStyles.secondaryButton} disabled={isCashHistorySaving}>
								등록
							</button>
						</div>
					</form>
				</div>
			) : null}

			{isCreateLayerOpen ? (
				<div className={stockStyles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="totalStockSaleCreateTitle">
					<form className={stockStyles.createModal} onSubmit={handleCreateSubmit}>
						<div className={stockStyles.modalHeader}>
							<div>
								<p className={stockStyles.eyebrow}>register</p>
								<h2 id="totalStockSaleCreateTitle" className={stockStyles.contentTitle}>매매등록</h2>
							</div>
							<button type="button" className={stockStyles.modalCloseButton} onClick={handleCloseCreateLayer} disabled={isCreateSaving} aria-label="매매등록 닫기">
								×
							</button>
						</div>

						<div className={stockStyles.createFormGrid}>
							<label className={stockStyles.fieldLabel}>
								날짜
								<AdminDateInput name="saleDt" value={createFormState.saleDt} onChange={handleCreateFormChange} disabled={isCreateSaving} />
							</label>
							<label className={stockStyles.fieldLabel}>
								계좌
								<select name="stockAccountCd" className={stockStyles.formControl} value={createFormState.stockAccountCd} onChange={handleCreateFormChange} disabled={isCreateSaving}>
									<option value="">선택</option>
									{accountOptionList.map((optionItem) => (
										<option key={optionItem.cd} value={optionItem.cd}>{optionItem.cdNm}</option>
									))}
								</select>
							</label>
							<label className={stockStyles.fieldLabel}>
								주식명
								<select name="stockNmCd" className={stockStyles.formControl} value={createFormState.stockNmCd} onChange={handleCreateFormChange} disabled={isCreateSaving}>
									<option value="">선택</option>
									{stockOptionList.map((optionItem) => (
										<option key={optionItem.cd} value={optionItem.cd}>{optionItem.cdNm}</option>
									))}
								</select>
							</label>
							<label className={stockStyles.fieldLabel}>
								매매수
								<input name="saleCnt" className={stockStyles.formControl} type="number" step="1" value={createFormState.saleCnt} onChange={handleCreateFormChange} disabled={isCreateSaving} />
							</label>
							<label className={stockStyles.fieldLabel}>
								매매금액
								<input name="saleAmt" className={stockStyles.formControl} type="text" inputMode="numeric" value={createFormState.saleAmt} onChange={handleCreateFormChange} disabled={isCreateSaving} />
							</label>
							<label className={stockStyles.fieldLabel}>
								거래단가
								<input name="unitPrice" className={stockStyles.formControl} type="text" inputMode="decimal" value={createFormState.unitPrice} onChange={handleCreateFormChange} disabled={isCreateSaving} />
							</label>
							<label className={`${stockStyles.fieldLabel} ${stockStyles.memoField}`}>
								메모
								<textarea name="memo" className={`${stockStyles.formControl} ${stockStyles.memoControl}`} value={createFormState.memo} onChange={handleCreateFormChange} disabled={isCreateSaving} maxLength={300} />
							</label>
						</div>

						<div className={stockStyles.modalActions}>
							<button type="button" className={stockStyles.ghostButton} onClick={handleCloseCreateLayer} disabled={isCreateSaving}>
								취소
							</button>
							<button type="submit" className={stockStyles.secondaryButton} disabled={isCreateSaving}>
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
				loadingVisible={isInitializing || isListLoading || isActionPending || isCreateSaving || isCheckAmountSaving || isCashHistorySaving}
				loadingMessage={blockingLoadingMessage}
				onErrorClose={clearError}
			/>
		</>
	);
}
