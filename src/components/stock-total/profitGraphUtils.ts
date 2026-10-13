import type { TotalStockProfitGraphPoint } from "./types";

// 그래프 날짜 축의 표시 단위를 정의합니다.
export type ProfitGraphUnit = "day" | "month" | "year";

// 선택 기간 안의 대표 확인일과 실제 날짜 축 범위를 전달합니다.
export interface ProfitGraphView {
	pointList: TotalStockProfitGraphPoint[];
	startDate: string;
	endDate: string;
}

// 같은 확인일의 원금과 평가금으로 손익금과 원금 대비 증감률을 반환합니다.
export function resolveGraphProfit(point: TotalStockProfitGraphPoint): { amount: number; rate: number | null } {
	// API의 원금 100% 비율을 원금 대비 증감률로 바꾸고 소수 오차를 정리합니다.
	return {
		amount: point.checkAmt - point.principalAmt,
		rate: point.principalRatio === null ? null : Number((point.principalRatio - 100).toFixed(2)),
	};
}

// 원금 대비 증감률을 부호가 있는 퍼센트로 표시합니다.
export function formatGraphProfitRate(rate: number | null, fractionDigits = 2): string {
	if (rate === null) return "계산 불가";
	// 원금과 같은 값은 부호 없이 표시하고 양수에만 +를 붙입니다.
	return `${rate > 0 ? "+" : ""}${rate.toLocaleString("ko-KR", { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })}%`;
}

// 시간대에 따라 날짜가 바뀌지 않도록 확인일을 UTC 기준으로 변환합니다.
export function graphDateTime(date: string): number {
	return Date.parse(`${date}T00:00:00Z`);
}

// UTC 날짜를 API와 동일한 날짜 문자열로 변환합니다.
function formatGraphDate(date: Date): string {
	return date.toISOString().slice(0, 10);
}

// 말일에서 월을 빼도 다음 달로 넘어가지 않도록 조회 시작일을 계산합니다.
function subtractGraphMonths(date: string, months: number): string {
	const target = new Date(graphDateTime(date));
	const day = target.getUTCDate();
	// 먼저 1일로 이동한 뒤 대상 월의 마지막 날 안으로 보정합니다.
	target.setUTCDate(1);
	target.setUTCMonth(target.getUTCMonth() - months);
	const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
	target.setUTCDate(Math.min(day, lastDay));
	return formatGraphDate(target);
}

// 최신 확인일 기준 기간을 제한하고 월·년별 마지막 확인일을 선택합니다.
export function buildProfitGraphView(source: TotalStockProfitGraphPoint[], unit: ProfitGraphUnit, months: number): ProfitGraphView {
	// 유효한 확인일만 정렬하며 입력 목록은 변경하지 않습니다.
	const sorted = source.filter((point) => /^\d{4}-\d{2}-\d{2}$/.test(point.checkDt)
		&& Number.isFinite(graphDateTime(point.checkDt))
		&& formatGraphDate(new Date(graphDateTime(point.checkDt))) === point.checkDt)
		.sort((first, second) => first.checkDt.localeCompare(second.checkDt));
	if (sorted.length === 0) return { pointList: [], startDate: "", endDate: "" };
	const endDate = sorted[sorted.length - 1].checkDt;
	const startDate = [sorted[0].checkDt, subtractGraphMonths(endDate, months)].sort()[1];
	const visible = sorted.filter((point) => point.checkDt >= startDate);
	// 금액과 비율은 합산·평균하지 않고 같은 확인일의 스냅샷을 함께 사용합니다.
	const periodMap = new Map<string, TotalStockProfitGraphPoint>();
	for (const point of visible) {
		const period = unit === "year" ? point.checkDt.slice(0, 4) : unit === "month" ? point.checkDt.slice(0, 7) : point.checkDt;
		periodMap.set(period, point);
	}
	return { pointList: Array.from(periodMap.values()), startDate, endDate };
}

// 날짜 표시 단위에 맞춰 축 레이블을 생성합니다.
export function formatGraphAxisDate(date: string, unit: ProfitGraphUnit): string {
	return (unit === "year" ? date.slice(0, 4) : unit === "month" ? date.slice(0, 7) : date).replaceAll("-", ".");
}

// 실제 기간의 일·월·년 경계를 생성하고 화면 폭에 맞춰 눈금 개수를 제한합니다.
export function buildGraphDateTicks(view: ProfitGraphView, unit: ProfitGraphUnit, limit: number): string[] {
	if (!view.startDate) return [];
	const ticks = [view.startDate];
	const cursor = new Date(graphDateTime(view.startDate));
	// 월과 년은 각각 다음 월초·연초부터, 일은 다음 날부터 생성합니다.
	if (unit === "year") cursor.setUTCFullYear(cursor.getUTCFullYear() + 1, 0, 1);
	else if (unit === "month") cursor.setUTCMonth(cursor.getUTCMonth() + 1, 1);
	else cursor.setUTCDate(cursor.getUTCDate() + 1);
	while (formatGraphDate(cursor) < view.endDate) {
		ticks.push(formatGraphDate(cursor));
		if (unit === "year") cursor.setUTCFullYear(cursor.getUTCFullYear() + 1);
		else if (unit === "month") cursor.setUTCMonth(cursor.getUTCMonth() + 1);
		else cursor.setUTCDate(cursor.getUTCDate() + 1);
	}
	ticks.push(view.endDate);
	const uniqueTicks = ticks.filter((date, index) => index === 0
		|| formatGraphAxisDate(date, unit) !== formatGraphAxisDate(ticks[index - 1], unit));
	if (uniqueTicks.length <= limit) return uniqueTicks;
	// 양 끝을 유지하고 중간 눈금을 균등하게 추립니다.
	return Array.from({ length: limit }, (_, index) => uniqueTicks[Math.round(index * (uniqueTicks.length - 1) / (limit - 1))]);
}

// 마우스 위치와 가장 가까운 실제 확인일을 이진 탐색합니다.
export function findNearestGraphPointIndex(points: TotalStockProfitGraphPoint[], time: number): number {
	let left = 0;
	let right = points.length - 1;
	while (left < right) {
		const middle = Math.floor((left + right) / 2);
		if (graphDateTime(points[middle].checkDt) < time) left = middle + 1;
		else right = middle;
	}
	if (left > 0 && time - graphDateTime(points[left - 1].checkDt) <= graphDateTime(points[left].checkDt) - time) return left - 1;
	return left;
}
