import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { TotalStockProfitGraphPoint } from "./types";
import { buildGraphDateTicks, buildProfitGraphView, findNearestGraphPointIndex, formatGraphAxisDate, formatGraphProfitRate, graphDateTime, resolveGraphProfit, type ProfitGraphUnit } from "./profitGraphUtils";
import styles from "./TotalStockProfitGraph.module.css";

const UNIT_OPTIONS: ReadonlyArray<{ value: ProfitGraphUnit; label: string }> = [
	{ value: "day", label: "일" }, { value: "month", label: "월" }, { value: "year", label: "년" },
];
const PERIOD_OPTIONS = [{ months: 1, label: "1개월" }, { months: 3, label: "3개월" }, { months: 6, label: "6개월" }, { months: 12, label: "1년" }, { months: 36, label: "3년" }];
const CHART_HEIGHT = 320;
const PLOT_TOP = 24;
const PLOT_BOTTOM = 290;
const PLOT_LEFT = 62;

// 원금과 평가금을 원화 표시로 변환합니다.
function formatGraphAmount(amount: number): string {
	return `${new Intl.NumberFormat("ko-KR").format(amount)}원`;
}

// 손익금의 방향을 부호와 함께 표시합니다.
function formatGraphProfitAmount(amount: number): string {
	return `${amount > 0 ? "+" : ""}${formatGraphAmount(amount)}`;
}

// 선택 계좌의 확인일별 원금 대비 평가금 비율을 그래프로 제공합니다.
export default function TotalStockProfitGraph({ pointList }: { pointList: TotalStockProfitGraphPoint[] }) {
	const [unit, setUnit] = useState<ProfitGraphUnit>("day");
	const [months, setMonths] = useState(3);
	const [selectedDate, setSelectedDate] = useState<string | null>(null);
	const [width, setWidth] = useState(900);
	const plotRef = useRef<HTMLDivElement>(null);
	const view = useMemo(() => buildProfitGraphView(pointList, unit, months), [pointList, unit, months]);
	const ticks = useMemo(() => buildGraphDateTicks(view, unit, width < 600 ? 3 : 6), [view, unit, width]);
	const hoveredIndex = selectedDate === null ? -1 : view.pointList.findIndex((point) => point.checkDt === selectedDate);
	const selectedIndex = hoveredIndex >= 0 ? hoveredIndex : Math.max(0, view.pointList.length - 1);
	const selectedPoint = view.pointList[selectedIndex];
	const selectedProfit = selectedPoint ? resolveGraphProfit(selectedPoint) : null;
	const plotRight = width - 24;
	const startTime = graphDateTime(view.startDate);
	const endTime = graphDateTime(view.endDate);
	// 원금과 같은 상태인 손익 0%가 중앙에 위치하도록 같은 범위를 적용합니다.
	const extent = useMemo(() => Math.max(10, Math.ceil(view.pointList.reduce((maximum, point) =>
		Math.max(maximum, point.principalRatio === null ? 0 : Math.abs(point.principalRatio - 100)), 0) / 5) * 5), [view]);
	const yTicks = [100 + extent, 100 + extent / 2, 100, 100 - extent / 2, 100 - extent];

	// 컨테이너 너비를 관찰해 글자와 날짜 눈금을 화면 크기에 맞춥니다.
	useEffect(() => {
		const element = plotRef.current;
		if (!element) return;
		const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)));
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	// 실제 날짜 간격을 유지하고 단일 확인일은 중앙에 배치합니다.
	const resolveX = (date: string): number => endTime === startTime ? (PLOT_LEFT + plotRight) / 2
		: PLOT_LEFT + (graphDateTime(date) - startTime) / (endTime - startTime) * (plotRight - PLOT_LEFT);
	// API의 평가금 비율을 손익 0%가 중앙인 좌표로 변환합니다.
	const resolveY = (ratio: number): number => (PLOT_TOP + PLOT_BOTTOM) / 2 - (ratio - 100) / extent * (PLOT_BOTTOM - PLOT_TOP) / 2;
	// 원금이 0 이하인 날짜에서는 선을 끊어 가상의 비율을 만들지 않습니다.
	const graphPath = useMemo(() => {
		let path = "";
		let isSegmentStart = true;
		for (const point of view.pointList) {
			if (point.principalRatio === null) { isSegmentStart = true; continue; }
			const x = endTime === startTime ? (PLOT_LEFT + plotRight) / 2 : PLOT_LEFT + (graphDateTime(point.checkDt) - startTime) / (endTime - startTime) * (plotRight - PLOT_LEFT);
			const y = (PLOT_TOP + PLOT_BOTTOM) / 2 - (point.principalRatio - 100) / extent * (PLOT_BOTTOM - PLOT_TOP) / 2;
			// 단일 확인일도 점 대신 짧은 선으로 비율 위치를 보여줍니다.
			if (view.pointList.length === 1) return `M${x - 4},${y}L${x + 4},${y}`;
			path += `${isSegmentStart ? "M" : "L"}${x},${y} `;
			isSegmentStart = false;
		}
		return path;
	}, [view, startTime, endTime, plotRight, extent]);

	// 마우스와 터치 위치에서 가장 가까운 실제 확인일의 정보를 선택합니다.
	const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
		if (view.pointList.length === 0) return;
		const rectangle = event.currentTarget.getBoundingClientRect();
		const x = (event.clientX - rectangle.left) * width / rectangle.width;
		const fraction = Math.max(0, Math.min(1, (x - PLOT_LEFT) / (plotRight - PLOT_LEFT)));
		const index = findNearestGraphPointIndex(view.pointList, startTime + fraction * (endTime - startTime));
		setSelectedDate(view.pointList[index].checkDt);
	};
	// 키보드 좌우 화살표와 처음·끝 키로 확인일 정보를 탐색합니다.
	const handleKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
		if (!selectedPoint || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
		event.preventDefault();
		const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? view.pointList.length - 1
			: Math.max(0, Math.min(view.pointList.length - 1, selectedIndex + (event.key === "ArrowLeft" ? -1 : 1)));
		setSelectedDate(view.pointList[nextIndex].checkDt);
	};

	return (
		<section className={styles.graphPanel} aria-label="원금대비손익율 그래프">
			<div className={styles.toolbar}>
				<div><h3>원금대비손익</h3><p>원금과 같으면 0% · 수익은 +, 손실은 -</p></div>
				<div className={styles.buttonGroup} aria-label="날짜 표시 단위">
					{UNIT_OPTIONS.map((option) => <button key={option.value} type="button" aria-pressed={unit === option.value} onClick={() => { setUnit(option.value); setSelectedDate(null); }}>{option.label}</button>)}
				</div>
			</div>
			<div className={styles.details} role="status" aria-live="polite" aria-atomic="true">
				<div><span>{unit === "day" ? "확인일" : unit === "month" ? "월 마지막 확인일" : "년 마지막 확인일"}</span><strong>{selectedPoint?.checkDt.replaceAll("-", ".") ?? "—"}</strong></div>
				<div><span>원금</span><strong>{selectedPoint ? formatGraphAmount(selectedPoint.principalAmt) : "—"}</strong></div>
				<div><span>평가금</span><strong>{selectedPoint ? formatGraphAmount(selectedPoint.checkAmt) : "—"}</strong></div>
				<div><span>손익</span><strong className={selectedProfit ? selectedProfit.amount > 0 ? styles.profitPositive : selectedProfit.amount < 0 ? styles.profitNegative : "" : ""}>{selectedProfit ? `${formatGraphProfitAmount(selectedProfit.amount)} (${formatGraphProfitRate(selectedProfit.rate)})` : "—"}</strong></div>
			</div>
			<div className={styles.plot} ref={plotRef}>
				{view.pointList.length === 0 ? <p className={styles.empty}>조회할 평가금 확인 이력이 없습니다.</p> : (
					<svg viewBox={`0 0 ${width} ${CHART_HEIGHT}`} role="group" aria-label="원금 대비 손익 0% 기준 그래프. 마우스 또는 좌우 화살표로 확인일 정보를 볼 수 있습니다." tabIndex={0} onPointerMove={handlePointerMove} onPointerLeave={() => setSelectedDate(null)} onKeyDown={handleKeyDown}>
						{yTicks.map((ratio) => <g key={ratio}><line x1={PLOT_LEFT} x2={plotRight} y1={resolveY(ratio)} y2={resolveY(ratio)} className={ratio === 100 ? styles.baseline : styles.gridLine} /><text x={PLOT_LEFT - 10} y={resolveY(ratio) + 4} textAnchor="end" className={ratio === 100 ? styles.baselineLabel : styles.axisLabel}>{formatGraphProfitRate(ratio - 100, Number.isInteger(ratio) ? 0 : 1)}</text></g>)}
						{ticks.map((date) => <g key={date}><line x1={resolveX(date)} x2={resolveX(date)} y1={PLOT_BOTTOM} y2={PLOT_BOTTOM + 6} className={styles.gridLine} /><text x={resolveX(date)} y={PLOT_BOTTOM + 26} textAnchor={date === view.startDate ? "start" : date === view.endDate ? "end" : "middle"} className={styles.axisLabel}>{formatGraphAxisDate(date, unit)}</text></g>)}
						<path d={graphPath} className={styles.graphLine} />
						{selectedPoint ? <line x1={resolveX(selectedPoint.checkDt)} x2={resolveX(selectedPoint.checkDt)} y1={PLOT_TOP} y2={PLOT_BOTTOM} className={styles.crosshair} /> : null}
					</svg>
				)}
			</div>
			<div className={styles.periodRow}><span>조회기간</span><div className={styles.buttonGroup} aria-label="조회기간">{PERIOD_OPTIONS.map((option) => <button key={option.months} type="button" aria-pressed={months === option.months} onClick={() => { setMonths(option.months); setSelectedDate(null); }}>{option.label}</button>)}</div></div>
			<p className={styles.note}>{view.startDate ? `${view.startDate.replaceAll("-", ".")} ~ ${view.endDate.replaceAll("-", ".")} · ` : ""}최신 확인일 기준 · 월/년은 기간 내 마지막 확인일 · 원금 0 이하의 손익율은 계산 불가</p>
		</section>
	);
}
