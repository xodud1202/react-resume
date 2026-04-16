import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type RefObject } from "react";

// 좌측 패널 리사이즈 훅 옵션을 정의합니다.
export interface UseResizableSplitLayoutOptions {
	// 기본 좌측 패널 너비입니다.
	defaultPrimaryWidth: number;
	// 좌측 패널 최소 너비입니다.
	minPrimaryWidth: number;
	// 좌측 패널 최대 너비입니다.
	maxPrimaryWidth: number;
	// 좌측 패널 최대 비율입니다.
	maxPrimaryWidthRatio?: number;
	// 우측 패널 최소 너비입니다.
	minSecondaryWidth: number;
	// 이 값 이하에서는 드래그 리사이즈를 비활성화합니다.
	collapseBreakpoint: number;
	// 레이아웃 CSS 변수명입니다.
	primaryWidthCssVar: string;
	// 키보드 리사이즈 한 번당 이동 폭입니다.
	resizeStep?: number;
}

// 좌측 패널 리사이즈 훅 반환값을 정의합니다.
export interface UseResizableSplitLayoutResult {
	// 분할 레이아웃 루트 ref입니다.
	containerRef: RefObject<HTMLDivElement | null>;
	// 루트에 주입할 CSS 변수 스타일입니다.
	layoutStyle: CSSProperties;
	// 현재 드래그 리사이즈 가능 여부입니다.
	isResizeEnabled: boolean;
	// 현재 드래그 중 여부입니다.
	isResizing: boolean;
	// 현재 좌측 패널 너비입니다.
	primaryWidth: number;
	// 현재 좌측 패널 최소 너비입니다.
	minimumPrimaryWidth: number;
	// 현재 좌측 패널 최대 너비입니다.
	maximumPrimaryWidth: number;
	// 리사이즈 핸들 pointer down 처리입니다.
	handleResizePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
	// 리사이즈 핸들 keyboard 처리입니다.
	handleResizeKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
}

// 숫자를 최소/최대 범위 안으로 고정합니다.
function clampNumber(value: number, minimumValue: number, maximumValue: number): number {
	return Math.min(Math.max(value, minimumValue), maximumValue);
}

// CSS 길이 문자열에서 px 숫자값을 추출합니다.
function resolvePixelNumber(value: string): number {
	const parsedValue = Number.parseFloat(value);
	return Number.isFinite(parsedValue) ? parsedValue : 0;
}

// 좌우 분할 레이아웃의 좌측 패널 너비를 드래그로 제어합니다.
export default function useResizableSplitLayout({
	defaultPrimaryWidth,
	minPrimaryWidth,
	maxPrimaryWidth,
	maxPrimaryWidthRatio,
	minSecondaryWidth,
	collapseBreakpoint,
	primaryWidthCssVar,
	resizeStep = 24,
}: UseResizableSplitLayoutOptions): UseResizableSplitLayoutResult {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const primaryWidthRef = useRef(defaultPrimaryWidth);
	const [primaryWidth, setPrimaryWidth] = useState(defaultPrimaryWidth);
	const [isResizing, setIsResizing] = useState(false);
	const [isResizeEnabled, setIsResizeEnabled] = useState(false);
	const [primaryWidthRange, setPrimaryWidthRange] = useState({
		minimumValue: minPrimaryWidth,
		maximumValue: maxPrimaryWidth,
	});

	// 최신 좌측 패널 너비를 ref에도 동기화합니다.
	useEffect(() => {
		primaryWidthRef.current = primaryWidth;
	}, [primaryWidth]);

	// 현재 레이아웃에서 허용 가능한 좌측 패널 너비 범위를 계산합니다.
	const resolvePrimaryWidthRange = useCallback(() => {
		if (typeof window === "undefined" || !containerRef.current) {
			return {
				minimumValue: minPrimaryWidth,
				maximumValue: maxPrimaryWidth,
				columnGapValue: 0,
			};
		}

		const containerRect = containerRef.current.getBoundingClientRect();
		const containerStyle = window.getComputedStyle(containerRef.current);
		const columnGapValue = resolvePixelNumber(containerStyle.columnGap);
		const maximumAvailableWidth = Math.max(0, containerRect.width - columnGapValue - minSecondaryWidth);
		const maximumRatioWidth =
			typeof maxPrimaryWidthRatio === "number" && Number.isFinite(maxPrimaryWidthRatio)
				? Math.max(0, containerRect.width * maxPrimaryWidthRatio)
				: Number.POSITIVE_INFINITY;
		const resolvedMaximumValue = Math.max(0, Math.min(maxPrimaryWidth, maximumAvailableWidth, maximumRatioWidth));
		const resolvedMinimumValue = Math.max(0, Math.min(minPrimaryWidth, resolvedMaximumValue));
		return {
			minimumValue: resolvedMinimumValue,
			maximumValue: resolvedMaximumValue,
			columnGapValue,
		};
	}, [maxPrimaryWidth, maxPrimaryWidthRatio, minPrimaryWidth, minSecondaryWidth]);

	// 후보 너비를 현재 레이아웃 기준으로 안전하게 보정합니다.
	const resolveClampedPrimaryWidth = useCallback((candidateWidth: number) => {
		const { minimumValue, maximumValue } = resolvePrimaryWidthRange();
		if (maximumValue <= 0) {
			return defaultPrimaryWidth;
		}
		return clampNumber(candidateWidth, minimumValue, maximumValue);
	}, [defaultPrimaryWidth, resolvePrimaryWidthRange]);

	// 브라우저 폭 기준으로 드래그 리사이즈 가능 여부를 갱신합니다.
	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		const syncResizeEnabled = () => {
			// 모바일/협소 폭에서는 기존 단일 컬럼 레이아웃을 유지합니다.
			setIsResizeEnabled(window.innerWidth > collapseBreakpoint);
		};

		syncResizeEnabled();
		window.addEventListener("resize", syncResizeEnabled);
		return () => {
			window.removeEventListener("resize", syncResizeEnabled);
		};
	}, [collapseBreakpoint]);

	// 컨테이너 크기가 바뀌면 현재 너비를 다시 보정합니다.
	useEffect(() => {
		if (typeof window === "undefined" || !containerRef.current) {
			return;
		}

		const syncPrimaryWidth = () => {
			const nextPrimaryWidthRange = resolvePrimaryWidthRange();
			setPrimaryWidthRange({
				minimumValue: nextPrimaryWidthRange.minimumValue,
				maximumValue: nextPrimaryWidthRange.maximumValue,
			});
			// 우측 패널 최소 너비를 침범하지 않도록 현재 값을 다시 클램프합니다.
			setPrimaryWidth((previousWidth) => resolveClampedPrimaryWidth(previousWidth));
		};

		syncPrimaryWidth();
		if (typeof ResizeObserver === "undefined") {
			window.addEventListener("resize", syncPrimaryWidth);
			return () => {
				window.removeEventListener("resize", syncPrimaryWidth);
			};
		}

		const resizeObserver = new ResizeObserver(() => {
			syncPrimaryWidth();
		});
		resizeObserver.observe(containerRef.current);
		return () => {
			resizeObserver.disconnect();
		};
	}, [resolveClampedPrimaryWidth, resolvePrimaryWidthRange]);

	// 드래그 시작 후 포인터 이동값을 좌측 패널 너비에 반영합니다.
	const handleResizePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
		if (!isResizeEnabled || typeof window === "undefined" || !containerRef.current) {
			return;
		}

		event.preventDefault();
		const previousCursor = document.body.style.cursor;
		const previousUserSelect = document.body.style.userSelect;

		// 드래그 중에는 텍스트 선택과 기본 커서를 잠시 막습니다.
		document.body.style.cursor = "col-resize";
		document.body.style.userSelect = "none";
		setIsResizing(true);
		event.currentTarget.focus();

		const handlePointerMove = (moveEvent: PointerEvent) => {
			if (!containerRef.current) {
				return;
			}

			const containerRect = containerRef.current.getBoundingClientRect();
			const { columnGapValue } = resolvePrimaryWidthRange();
			const nextPrimaryWidth = moveEvent.clientX - containerRect.left - (columnGapValue / 2);
			setPrimaryWidth(resolveClampedPrimaryWidth(nextPrimaryWidth));
		};

		const stopResize = () => {
			// 드래그 종료 후 문서 상태를 원래대로 되돌립니다.
			document.body.style.cursor = previousCursor;
			document.body.style.userSelect = previousUserSelect;
			setIsResizing(false);
			window.removeEventListener("pointermove", handlePointerMove);
			window.removeEventListener("pointerup", stopResize);
			window.removeEventListener("pointercancel", stopResize);
		};

		window.addEventListener("pointermove", handlePointerMove);
		window.addEventListener("pointerup", stopResize);
		window.addEventListener("pointercancel", stopResize);
	};

	// 키보드 화살표와 Home/End로 좌측 패널 너비를 조정합니다.
	const handleResizeKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
		if (!isResizeEnabled) {
			return;
		}

		if (event.key === "ArrowLeft") {
			event.preventDefault();
			setPrimaryWidth(resolveClampedPrimaryWidth(primaryWidthRef.current - resizeStep));
			return;
		}
		if (event.key === "ArrowRight") {
			event.preventDefault();
			setPrimaryWidth(resolveClampedPrimaryWidth(primaryWidthRef.current + resizeStep));
			return;
		}
		if (event.key === "Home") {
			event.preventDefault();
			setPrimaryWidth(resolveClampedPrimaryWidth(minPrimaryWidth));
			return;
		}
		if (event.key === "End") {
			event.preventDefault();
			setPrimaryWidth(resolveClampedPrimaryWidth(maxPrimaryWidth));
		}
	};

	// 레이아웃 CSS 변수 스타일을 계산합니다.
	const layoutStyle = useMemo(
		() =>
			({
				[primaryWidthCssVar]: `${primaryWidth}px`,
			}) as CSSProperties,
		[primaryWidth, primaryWidthCssVar],
	);

	return {
		containerRef,
		layoutStyle,
		isResizeEnabled,
		isResizing,
		primaryWidth,
		minimumPrimaryWidth: primaryWidthRange.minimumValue,
		maximumPrimaryWidth: primaryWidthRange.maximumValue,
		handleResizePointerDown,
		handleResizeKeyDown,
	};
}
