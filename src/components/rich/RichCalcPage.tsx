import Head from "next/head";
import Link from "next/link";
import { useMemo, useState, type ChangeEvent } from "react";
import styles from "./RichCalcPage.module.css";

const MAX_PAYMENT_YEAR = 50;
const CHART_WIDTH = 760;
const CHART_HEIGHT = 340;
const CHART_PADDING = {
	top: 28,
	right: 26,
	bottom: 42,
	left: 74,
};
const CHART_GUIDE_LINE_COUNT = 5;
const CHART_TOOLTIP_WIDTH = 188;
const CHART_TOOLTIP_HEIGHT = 58;
const CHART_TOOLTIP_GAP = 16;
const FINANCIAL_FREEDOM_YEAR_COUNT = 30;

type RichCalcTab = "wealth" | "freedom";

interface RichCalcPageProps {
	// 최초로 활성화할 계산기 탭입니다.
	initialTab?: RichCalcTab;
}

interface RichCalcFormState {
	// 원금 입력값입니다.
	principalAmt: string;
	// 월 납입금 입력값입니다.
	monthlyPaymentAmt: string;
	// 납입기간 입력값입니다.
	paymentYear: string;
	// 예상 연수익률 입력값입니다.
	annualReturnRate: string;
}

interface FinancialFreedomFormState {
	// 희망 월 수입 입력값입니다.
	desiredMonthlyIncomeAmt: string;
	// 달성 가능한 연 수익률 입력값입니다.
	annualReturnRate: string;
}

interface RichCalcParsedInput {
	// 계산 기준 원금입니다.
	principalAmt: number;
	// 계산 기준 월 납입금입니다.
	monthlyPaymentAmt: number;
	// 계산 기준 납입기간입니다.
	paymentYear: number;
	// 계산 기준 예상 연수익률입니다.
	annualReturnRate: number;
}

interface FinancialFreedomParsedInput {
	// 계산 기준 희망 월 수입입니다.
	desiredMonthlyIncomeAmt: number;
	// 계산 기준 달성 가능한 연 수익률입니다.
	annualReturnRate: number;
}

interface RichCalcYearPoint {
	// 경과 연차입니다.
	year: number;
	// 해당 연차까지 납입한 원금입니다.
	principalAmt: number;
	// 해당 연차 예상 수익금입니다.
	profitAmt: number;
	// 해당 연차 예상 총 금액입니다.
	totalAmt: number;
}

interface RichCalcSummary {
	// 최종 납입 원금입니다.
	principalAmt: number;
	// 최종 예상 수익금입니다.
	profitAmt: number;
	// 최종 예상 총 금액입니다.
	totalAmt: number;
}

interface RichCalcResult {
	// 연차별 그래프 데이터입니다.
	pointList: RichCalcYearPoint[];
	// 하단 요약 데이터입니다.
	summary: RichCalcSummary;
}

interface FinancialFreedomResult {
	// 연간 필요 수입입니다.
	annualIncomeAmt: number;
	// 수익률만으로 희망 월 수입을 달성하기 위해 필요한 금액입니다.
	yieldOnlyPrincipalAmt: number | null;
	// 30년 동안 원금까지 소진하며 사용할 최소 금액입니다.
	thirtyYearMinimumPrincipalAmt: number;
}

interface RichCalcSvgPoint extends RichCalcYearPoint {
	// SVG x 좌표입니다.
	x: number;
	// SVG y 좌표입니다.
	y: number;
}

interface RichCalcGuideLine {
	// 가이드라인 y 좌표입니다.
	y: number;
	// 가이드라인 금액 값입니다.
	value: number;
}

interface RichCalcChartGeometry {
	// SVG 선 그래프 path입니다.
	linePath: string;
	// SVG 면적 그래프 path입니다.
	areaPath: string;
	// SVG 좌표가 반영된 포인트 목록입니다.
	svgPointList: RichCalcSvgPoint[];
	// 그래프 금액 가이드라인 목록입니다.
	guideLineList: RichCalcGuideLine[];
	// x축 라벨로 노출할 포인트 목록입니다.
	axisLabelPointList: RichCalcSvgPoint[];
}

interface RichCalcTooltipPosition {
	// 툴팁 SVG x 좌표입니다.
	x: number;
	// 툴팁 SVG y 좌표입니다.
	y: number;
}

const DEFAULT_FORM_STATE: RichCalcFormState = {
	principalAmt: "22,000,000",
	monthlyPaymentAmt: "1,000,000",
	paymentYear: "17",
	annualReturnRate: "10",
};

const DEFAULT_FINANCIAL_FREEDOM_FORM_STATE: FinancialFreedomFormState = {
	desiredMonthlyIncomeAmt: "3,600,000",
	annualReturnRate: "10",
};

// 금액 문자열에서 숫자 값만 추출합니다.
function parseMoneyValue(value: string): number {
	const numericText = value.replace(/[^\d]/g, "");
	return Number(numericText || "0");
}

// 소수 입력 문자열을 계산 가능한 숫자로 변환합니다.
function parseDecimalValue(value: string): number {
	const normalizedText = normalizeDecimalText(value);
	return Number(normalizedText || "0");
}

// 숫자 입력 문자열을 납입기간 숫자로 변환합니다.
function parsePaymentYearValue(value: string): number {
	const rawYear = parseMoneyValue(value);
	return Math.min(MAX_PAYMENT_YEAR, Math.max(0, rawYear));
}

// 금액 입력값을 천 단위 콤마가 있는 문자열로 정리합니다.
function formatMoneyInput(value: string): string {
	const numericText = value.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
	if (numericText === "") {
		return "";
	}
	return Number(numericText).toLocaleString("ko-KR");
}

// 납입기간 입력값을 허용 범위 안의 정수 문자열로 정리합니다.
function formatPaymentYearInput(value: string): string {
	const numericText = value.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
	if (numericText === "") {
		return "";
	}
	return String(Math.min(MAX_PAYMENT_YEAR, Number(numericText)));
}

// 연수익률 입력값을 소수점 하나만 허용하는 문자열로 정리합니다.
function formatAnnualReturnRateInput(value: string): string {
	const normalizedText = normalizeDecimalText(value);
	if (normalizedText === "") {
		return "";
	}
	const [integerPart, decimalPart] = normalizedText.split(".");
	const compactIntegerPart = integerPart.replace(/^0+(?=\d)/, "") || "0";
	if (decimalPart === undefined) {
		return compactIntegerPart;
	}
	return `${compactIntegerPart}.${decimalPart.slice(0, 2)}`;
}

// 소수 입력값에서 숫자와 첫 번째 소수점만 남깁니다.
function normalizeDecimalText(value: string): string {
	const numericText = value.replace(/[^\d.]/g, "");
	const firstDotIndex = numericText.indexOf(".");
	if (firstDotIndex < 0) {
		return numericText;
	}

	// 첫 번째 소수점 뒤의 추가 소수점은 제거합니다.
	const integerPart = numericText.slice(0, firstDotIndex);
	const decimalPart = numericText.slice(firstDotIndex + 1).replace(/\./g, "");
	return `${integerPart}.${decimalPart}`;
}

// 화면 입력값을 계산용 숫자 값으로 변환합니다.
function parseRichCalcInput(formState: RichCalcFormState): RichCalcParsedInput {
	return {
		principalAmt: parseMoneyValue(formState.principalAmt),
		monthlyPaymentAmt: parseMoneyValue(formState.monthlyPaymentAmt),
		paymentYear: parsePaymentYearValue(formState.paymentYear),
		annualReturnRate: parseDecimalValue(formState.annualReturnRate),
	};
}

// 경제적 자유 입력값을 계산용 숫자 값으로 변환합니다.
function parseFinancialFreedomInput(formState: FinancialFreedomFormState): FinancialFreedomParsedInput {
	return {
		desiredMonthlyIncomeAmt: parseMoneyValue(formState.desiredMonthlyIncomeAmt),
		annualReturnRate: parseDecimalValue(formState.annualReturnRate),
	};
}

// 입력값을 기준으로 연차별 예상 금액과 최종 요약을 계산합니다.
function calculateRichCalcResult(formState: RichCalcFormState): RichCalcResult {
	const parsedInput = parseRichCalcInput(formState);
	const monthlyReturnRate = Math.pow(1 + parsedInput.annualReturnRate / 100, 1 / 12) - 1;
	const pointList: RichCalcYearPoint[] = [];
	let totalAmt = parsedInput.principalAmt;

	// 월 단위로 복리와 납입금을 반영하고, 매 12개월마다 그래프 데이터를 저장합니다.
	for (let yearIndex = 1; yearIndex <= parsedInput.paymentYear; yearIndex += 1) {
		for (let monthIndex = 1; monthIndex <= 12; monthIndex += 1) {
			totalAmt = totalAmt * (1 + monthlyReturnRate) + parsedInput.monthlyPaymentAmt;
		}

		const principalAmt = parsedInput.principalAmt + parsedInput.monthlyPaymentAmt * yearIndex * 12;
		const roundedTotalAmt = Math.round(totalAmt);
		pointList.push({
			year: yearIndex,
			principalAmt,
			profitAmt: roundedTotalAmt - principalAmt,
			totalAmt: roundedTotalAmt,
		});
	}

	const summary = pointList.at(-1) ?? {
		principalAmt: parsedInput.principalAmt,
		profitAmt: 0,
		totalAmt: parsedInput.principalAmt,
	};

	return {
		pointList,
		summary,
	};
}

// 입력값을 기준으로 경제적 자유 달성에 필요한 금액을 계산합니다.
function calculateFinancialFreedomResult(formState: FinancialFreedomFormState): FinancialFreedomResult {
	const parsedInput = parseFinancialFreedomInput(formState);
	const annualIncomeAmt = parsedInput.desiredMonthlyIncomeAmt * 12;
	const annualReturnRate = parsedInput.annualReturnRate / 100;
	const yieldOnlyPrincipalAmt = annualReturnRate > 0 ? Math.round(annualIncomeAmt / annualReturnRate) : null;
	const thirtyYearMinimumPrincipalAmt =
		annualReturnRate > 0
			? Math.round((annualIncomeAmt * (1 - Math.pow(1 + annualReturnRate, -FINANCIAL_FREEDOM_YEAR_COUNT))) / annualReturnRate)
			: annualIncomeAmt * FINANCIAL_FREEDOM_YEAR_COUNT;

	return {
		annualIncomeAmt,
		yieldOnlyPrincipalAmt,
		thirtyYearMinimumPrincipalAmt,
	};
}

// 그래프 최대값을 보기 좋은 단위로 올림 처리합니다.
function resolveChartMaxValue(pointList: RichCalcYearPoint[]): number {
	const maxValue = Math.max(...pointList.map((pointItem) => pointItem.totalAmt), 1);
	const unit = maxValue >= 100000000 ? 10000000 : 1000000;
	return Math.ceil(maxValue / unit) * unit;
}

// SVG 좌표를 연결하는 path 문자열을 생성합니다.
function buildLinePath(svgPointList: RichCalcSvgPoint[]): string {
	return svgPointList.map((pointItem, pointIndex) => `${pointIndex === 0 ? "M" : "L"} ${pointItem.x} ${pointItem.y}`).join(" ");
}

// SVG 좌표를 기준으로 면적 그래프 path 문자열을 생성합니다.
function buildAreaPath(svgPointList: RichCalcSvgPoint[]): string {
	if (svgPointList.length === 0) {
		return "";
	}

	const bottomY = CHART_HEIGHT - CHART_PADDING.bottom;
	const firstPoint = svgPointList[0];
	const lastPoint = svgPointList[svgPointList.length - 1];
	return `M ${firstPoint.x} ${bottomY} ${buildLinePath(svgPointList)} L ${lastPoint.x} ${bottomY} Z`;
}

// 그래프 축에 표시할 대표 연차 포인트를 추립니다.
function resolveAxisLabelPointList(svgPointList: RichCalcSvgPoint[]): RichCalcSvgPoint[] {
	if (svgPointList.length <= 3) {
		return svgPointList;
	}

	// 시작, 중간, 종료 연차를 고정으로 보여 차트 폭이 좁아져도 라벨 겹침을 줄입니다.
	const middleIndex = Math.floor((svgPointList.length - 1) / 2);
	return [svgPointList[0], svgPointList[middleIndex], svgPointList[svgPointList.length - 1]];
}

// 연차별 예상 금액 데이터를 SVG 그래프 좌표로 변환합니다.
function buildChartGeometry(pointList: RichCalcYearPoint[]): RichCalcChartGeometry {
	if (pointList.length === 0) {
		return {
			linePath: "",
			areaPath: "",
			svgPointList: [],
			guideLineList: [],
			axisLabelPointList: [],
		};
	}

	const chartMaxValue = resolveChartMaxValue(pointList);
	const innerWidth = CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
	const innerHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;
	const bottomY = CHART_HEIGHT - CHART_PADDING.bottom;
	const svgPointList = pointList.map((pointItem, pointIndex) => {
		const pointRatio = pointList.length === 1 ? 0.5 : pointIndex / (pointList.length - 1);
		const amountRatio = pointItem.totalAmt / chartMaxValue;
		return {
			...pointItem,
			x: CHART_PADDING.left + innerWidth * pointRatio,
			y: bottomY - innerHeight * amountRatio,
		};
	});
	const guideLineList = Array.from({ length: CHART_GUIDE_LINE_COUNT }, (_, guideIndex) => {
		const guideRatio = guideIndex / (CHART_GUIDE_LINE_COUNT - 1);
		return {
			y: CHART_PADDING.top + innerHeight * guideRatio,
			value: Math.round(chartMaxValue * (1 - guideRatio)),
		};
	});

	return {
		linePath: buildLinePath(svgPointList),
		areaPath: buildAreaPath(svgPointList),
		svgPointList,
		guideLineList,
		axisLabelPointList: resolveAxisLabelPointList(svgPointList),
	};
}

// 원 단위 금액을 전체 표기 문자열로 변환합니다.
function formatWon(value: number): string {
	return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

// 계산 가능한 금액만 원 단위 문자열로 변환합니다.
function formatNullableWon(value: number | null): string {
	if (value === null) {
		return "수익률 입력 필요";
	}
	return formatWon(value);
}

// 그래프 축에 사용할 축약 금액 문자열을 변환합니다.
function formatCompactWon(value: number): string {
	if (value >= 100000000) {
		return `${(value / 100000000).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}억`;
	}
	if (value >= 10000) {
		return `${Math.round(value / 10000).toLocaleString("ko-KR")}만`;
	}
	return value.toLocaleString("ko-KR");
}

// 예상 수익금 값의 양수/음수 스타일을 구분합니다.
function resolveProfitClassName(value: number): string {
	if (value > 0) {
		return styles.positiveValue;
	}
	if (value < 0) {
		return styles.negativeValue;
	}
	return "";
}

// 그래프 포인트 툴팁의 aria-label 문구를 생성합니다.
function formatChartTooltipLabel(pointItem: RichCalcYearPoint): string {
	return `${pointItem.year}년 후 예상 총 금액 ${formatWon(pointItem.totalAmt)}`;
}

// SVG 내부 툴팁이 차트 밖으로 나가지 않도록 위치를 계산합니다.
function buildTooltipPosition(pointItem: RichCalcSvgPoint): RichCalcTooltipPosition {
	const preferredX = pointItem.x - CHART_TOOLTIP_WIDTH / 2;
	const minX = CHART_PADDING.left;
	const maxX = CHART_WIDTH - CHART_PADDING.right - CHART_TOOLTIP_WIDTH;
	const x = Math.min(Math.max(preferredX, minX), maxX);
	const preferredTopY = pointItem.y - CHART_TOOLTIP_HEIGHT - CHART_TOOLTIP_GAP;
	const y = preferredTopY < CHART_PADDING.top ? pointItem.y + CHART_TOOLTIP_GAP : preferredTopY;
	return { x, y };
}

// 부자계산기 화면을 렌더링합니다.
export default function RichCalcPage({ initialTab = "wealth" }: RichCalcPageProps) {
	const activeTab = initialTab;
	const [formState, setFormState] = useState<RichCalcFormState>(DEFAULT_FORM_STATE);
	const [financialFreedomFormState, setFinancialFreedomFormState] = useState<FinancialFreedomFormState>(DEFAULT_FINANCIAL_FREEDOM_FORM_STATE);
	const result = useMemo(() => calculateRichCalcResult(formState), [formState]);
	const chartGeometry = useMemo(() => buildChartGeometry(result.pointList), [result.pointList]);
	const financialFreedomResult = useMemo(() => calculateFinancialFreedomResult(financialFreedomFormState), [financialFreedomFormState]);

	// 원금 입력값을 갱신합니다.
	const handleChangePrincipalAmt = (event: ChangeEvent<HTMLInputElement>) => {
		setFormState((prevState) => ({
			...prevState,
			principalAmt: formatMoneyInput(event.target.value),
		}));
	};

	// 월 납입금 입력값을 갱신합니다.
	const handleChangeMonthlyPaymentAmt = (event: ChangeEvent<HTMLInputElement>) => {
		setFormState((prevState) => ({
			...prevState,
			monthlyPaymentAmt: formatMoneyInput(event.target.value),
		}));
	};

	// 납입기간 입력값을 갱신합니다.
	const handleChangePaymentYear = (event: ChangeEvent<HTMLInputElement>) => {
		setFormState((prevState) => ({
			...prevState,
			paymentYear: formatPaymentYearInput(event.target.value),
		}));
	};

	// 예상 연수익률 입력값을 갱신합니다.
	const handleChangeAnnualReturnRate = (event: ChangeEvent<HTMLInputElement>) => {
		setFormState((prevState) => ({
			...prevState,
			annualReturnRate: formatAnnualReturnRateInput(event.target.value),
		}));
	};

	// 희망 월 수입 입력값을 갱신합니다.
	const handleChangeDesiredMonthlyIncomeAmt = (event: ChangeEvent<HTMLInputElement>) => {
		setFinancialFreedomFormState((prevState) => ({
			...prevState,
			desiredMonthlyIncomeAmt: formatMoneyInput(event.target.value),
		}));
	};

	// 달성 가능한 연 수익률 입력값을 갱신합니다.
	const handleChangeFinancialFreedomAnnualReturnRate = (event: ChangeEvent<HTMLInputElement>) => {
		setFinancialFreedomFormState((prevState) => ({
			...prevState,
			annualReturnRate: formatAnnualReturnRateInput(event.target.value),
		}));
	};

	return (
		<>
			<Head>
				<title>부자계산기</title>
				<meta name="description" content="원금, 월 납입금, 납입기간, 예상 연수익률 기반 부자계산기" />
			</Head>

			<main className={styles.pageShell}>
				<section className={styles.pageHeader} aria-labelledby="rich-calc-page-title">
					<div className={styles.titleGroup}>
						<p className={styles.eyebrow}>자산 계산</p>
						<h1 id="rich-calc-page-title" className={styles.pageTitle}>
							부자계산기
						</h1>
					</div>
					<div className={styles.tabList} role="tablist" aria-label="부자계산기 메뉴">
						<Link
							href="/rich/calc"
							className={`${styles.tabButton} ${activeTab === "wealth" ? styles.tabButtonActive : ""}`}
							role="tab"
							aria-selected={activeTab === "wealth"}
							aria-controls="wealth-calculator-panel"
							id="wealth-calculator-tab"
						>
							부자계산기
						</Link>
						<Link
							href="/rich/freedom"
							className={`${styles.tabButton} ${activeTab === "freedom" ? styles.tabButtonActive : ""}`}
							role="tab"
							aria-selected={activeTab === "freedom"}
							aria-controls="financial-freedom-panel"
							id="financial-freedom-tab"
						>
							경제적 자유
						</Link>
					</div>
				</section>

				{activeTab === "wealth" ? (
					<div id="wealth-calculator-panel" role="tabpanel" aria-labelledby="wealth-calculator-tab">
						<section className={styles.topLayout} aria-label="부자계산기 입력과 그래프">
							<section className={styles.inputPanel} aria-labelledby="rich-calc-title">
								<div className={styles.titleGroup}>
									<p className={styles.eyebrow}>자산 증식</p>
									<h2 id="rich-calc-title" className={styles.sectionTitle}>
										투자 계산
									</h2>
								</div>

								<div className={styles.inputGrid}>
									<label className={styles.fieldLabel}>
										<span>원금</span>
										<input
											type="text"
											inputMode="numeric"
											value={formState.principalAmt}
											onChange={handleChangePrincipalAmt}
											className={styles.fieldInput}
											aria-label="원금"
										/>
									</label>
									<label className={styles.fieldLabel}>
										<span>월 납입금</span>
										<input
											type="text"
											inputMode="numeric"
											value={formState.monthlyPaymentAmt}
											onChange={handleChangeMonthlyPaymentAmt}
											className={styles.fieldInput}
											aria-label="월 납입금"
										/>
									</label>
									<label className={styles.fieldLabel}>
										<span>납입기간(년)</span>
										<input
											type="text"
											inputMode="numeric"
											value={formState.paymentYear}
											onChange={handleChangePaymentYear}
											className={styles.fieldInput}
											aria-label="납입기간"
										/>
									</label>
									<label className={styles.fieldLabel}>
										<span>예상 연수익률(%)</span>
										<input
											type="text"
											inputMode="decimal"
											value={formState.annualReturnRate}
											onChange={handleChangeAnnualReturnRate}
											className={styles.fieldInput}
											aria-label="예상 연수익률"
										/>
									</label>
								</div>
							</section>

							<section className={styles.chartPanel} aria-labelledby="rich-calc-chart-title">
								<div className={styles.chartHeader}>
									<div>
										<p className={styles.eyebrow}>연도별 전망</p>
										<h2 id="rich-calc-chart-title" className={styles.sectionTitle}>
											연도별 예상 총 금액
										</h2>
									</div>
									<p className={styles.chartTotal}>{formatWon(result.summary.totalAmt)}</p>
								</div>

								<div className={styles.chartCanvas}>
									{chartGeometry.svgPointList.length > 0 ? (
										<svg className={styles.chartSvg} viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} aria-label="납입기간 동안의 연도별 예상 총 금액 그래프">
											<defs>
												<linearGradient id="richCalcAreaGradient" x1="0" x2="0" y1="0" y2="1">
													<stop offset="0%" stopColor="#16a34a" stopOpacity="0.26" />
													<stop offset="100%" stopColor="#2563eb" stopOpacity="0.04" />
												</linearGradient>
											</defs>
											{chartGeometry.guideLineList.map((guideItem) => (
												<g key={guideItem.value} className={styles.guideLineGroup}>
													<line x1={CHART_PADDING.left} x2={CHART_WIDTH - CHART_PADDING.right} y1={guideItem.y} y2={guideItem.y} />
													<text x={CHART_PADDING.left - 12} y={guideItem.y + 4}>
														{formatCompactWon(guideItem.value)}
													</text>
												</g>
											))}
											<path d={chartGeometry.areaPath} className={styles.areaPath} />
											<path d={chartGeometry.linePath} className={styles.linePath} />
											{chartGeometry.svgPointList.map((pointItem) => (
												<circle key={pointItem.year} cx={pointItem.x} cy={pointItem.y} r="4.8" className={styles.pointMark} />
											))}
											{chartGeometry.svgPointList.map((pointItem) => {
												const tooltipPosition = buildTooltipPosition(pointItem);
												return (
													<g key={`tooltip-${pointItem.year}`} className={styles.tooltipPointGroup}>
														<circle
															cx={pointItem.x}
															cy={pointItem.y}
															r="13"
															className={styles.tooltipHitCircle}
															tabIndex={0}
															role="button"
															aria-label={formatChartTooltipLabel(pointItem)}
														/>
														<g className={styles.chartTooltipGroup} transform={`translate(${tooltipPosition.x} ${tooltipPosition.y})`} aria-hidden="true">
															<rect width={CHART_TOOLTIP_WIDTH} height={CHART_TOOLTIP_HEIGHT} rx="8" />
															<text x="14" y="22" className={styles.tooltipYear}>
																{pointItem.year}년 후
															</text>
															<text x="14" y="43" className={styles.tooltipAmount}>
																{formatWon(pointItem.totalAmt)}
															</text>
														</g>
													</g>
												);
											})}
											{chartGeometry.axisLabelPointList.map((pointItem) => (
												<text key={pointItem.year} x={pointItem.x} y={CHART_HEIGHT - 12} className={styles.axisLabel}>
													{pointItem.year}년
												</text>
											))}
										</svg>
									) : (
										<p className={styles.emptyChartText}>납입기간을 입력하면 그래프가 표시됩니다.</p>
									)}
								</div>
							</section>
						</section>

						<section className={styles.summaryGrid} aria-label="부자계산기 요약">
							<div className={styles.summaryItem}>
								<p className={styles.summaryLabel}>납입 원금</p>
								<p className={styles.summaryValue}>{formatWon(result.summary.principalAmt)}</p>
							</div>
							<div className={styles.summaryItem}>
								<p className={styles.summaryLabel}>예상 수익금</p>
								<p className={`${styles.summaryValue} ${resolveProfitClassName(result.summary.profitAmt)}`}>{formatWon(result.summary.profitAmt)}</p>
							</div>
							<div className={styles.summaryItem}>
								<p className={styles.summaryLabel}>예상 총 금액</p>
								<p className={styles.summaryValue}>{formatWon(result.summary.totalAmt)}</p>
							</div>
						</section>
					</div>
				) : (
					<section className={styles.freedomLayout} id="financial-freedom-panel" role="tabpanel" aria-labelledby="financial-freedom-tab">
						<section className={styles.inputPanel} aria-labelledby="financial-freedom-title">
							<div className={styles.titleGroup}>
								<p className={styles.eyebrow}>목표 수입</p>
								<h2 id="financial-freedom-title" className={styles.sectionTitle}>
									경제적 자유
								</h2>
							</div>

							<div className={styles.inputGrid}>
								<label className={styles.fieldLabel}>
									<span>희망 월 수입</span>
									<input
										type="text"
										inputMode="numeric"
										value={financialFreedomFormState.desiredMonthlyIncomeAmt}
										onChange={handleChangeDesiredMonthlyIncomeAmt}
										className={styles.fieldInput}
										aria-label="희망 월 수입"
									/>
								</label>
								<label className={styles.fieldLabel}>
									<span>달성 가능한 연 수익률(%)</span>
									<input
										type="text"
										inputMode="decimal"
										value={financialFreedomFormState.annualReturnRate}
										onChange={handleChangeFinancialFreedomAnnualReturnRate}
										className={styles.fieldInput}
										aria-label="달성 가능한 연 수익률"
									/>
								</label>
							</div>
						</section>

						<section className={styles.freedomResultPanel} aria-labelledby="financial-freedom-result-title">
							<div className={styles.chartHeader}>
								<div>
									<p className={styles.eyebrow}>필요 자산</p>
									<h2 id="financial-freedom-result-title" className={styles.sectionTitle}>
										경제적 자유 결과
									</h2>
								</div>
								<p className={styles.chartTotal}>{formatWon(financialFreedomResult.annualIncomeAmt)}</p>
							</div>

							<div className={styles.freedomMetricList}>
								<div className={styles.freedomMetricItem}>
									<p className={styles.freedomMetricLabel}>수익률로만 달성하기 위한 금액</p>
									<p className={styles.freedomMetricValue}>{formatNullableWon(financialFreedomResult.yieldOnlyPrincipalAmt)}</p>
								</div>
								<div className={styles.freedomMetricItem}>
									<p className={styles.freedomMetricLabel}>30년 사용 최소 금액</p>
									<p className={styles.freedomMetricValue}>{formatWon(financialFreedomResult.thirtyYearMinimumPrincipalAmt)}</p>
								</div>
							</div>
						</section>
					</section>
				)}
			</main>
		</>
	);
}
