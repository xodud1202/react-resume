import { forwardRef, useCallback, useRef, type ForwardedRef, type InputHTMLAttributes } from "react";
import styles from "./AdminDateInput.module.css";

interface AdminDateInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
	// 날짜 입력 래퍼에 추가할 클래스명입니다.
	wrapperClassName?: string;
}

// 날짜 입력 ref를 내부 ref와 외부 ref에 함께 연결합니다.
function assignInputRef(targetRef: ForwardedRef<HTMLInputElement>, element: HTMLInputElement | null) {
	// 함수 ref면 전달받은 element를 그대로 넘깁니다.
	if (typeof targetRef === "function") {
		targetRef(element);
		return;
	}

	// 객체 ref면 current에 element를 직접 반영합니다.
	if (targetRef) {
		targetRef.current = element;
	}
}

// 좌측 아이콘과 함께 브라우저 날짜 선택기를 여는 공통 날짜 입력을 렌더링합니다.
const AdminDateInput = forwardRef<HTMLInputElement, AdminDateInputProps>(function AdminDateInput(
	{
		className = "",
		wrapperClassName = "",
		disabled,
		readOnly,
		...inputProps
	},
	ref,
) {
	const inputRef = useRef<HTMLInputElement | null>(null);

	// 내부 ref와 외부 ref를 동시에 동기화합니다.
	const handleInputRef = useCallback((element: HTMLInputElement | null) => {
		inputRef.current = element;
		assignInputRef(ref, element);
	}, [ref]);

	// 캘린더 아이콘 클릭 시 브라우저 날짜 선택기를 엽니다.
	const handleClickCalendarButton = useCallback(() => {
		if (!inputRef.current || disabled || readOnly) {
			return;
		}

		try {
			// 지원 브라우저면 기본 날짜 선택기를 직접 엽니다.
			if (typeof inputRef.current.showPicker === "function") {
				inputRef.current.showPicker();
				return;
			}
		} catch (errorObject) {
			// showPicker 실패 시 포커스 기반 폴백으로 이어갑니다.
			console.error("날짜 선택기 호출에 실패했습니다.", errorObject);
		}

		// showPicker 미지원 환경은 포커스와 클릭으로 대체합니다.
		inputRef.current.focus();
		inputRef.current.click();
	}, [disabled, readOnly]);

	return (
		<div className={[styles.dateInputWrapper, wrapperClassName].filter(Boolean).join(" ")}>
			<button
				type="button"
				className={styles.dateInputIcon}
				onClick={handleClickCalendarButton}
				disabled={disabled || readOnly}
				tabIndex={-1}
				aria-label="날짜 선택"
			>
				<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
					<path
						fill="currentColor"
						d="M7 2h2v2h6V2h2v2h3a2 2 0 0 1 2 2v12a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V6a2 2 0 0 1 2-2h3V2Zm13 8H4v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8ZM6 6v2h12V6H6Z"
					/>
				</svg>
			</button>
			<input
				{...inputProps}
				ref={handleInputRef}
				type="date"
				className={[styles.dateInputControl, className].filter(Boolean).join(" ")}
				disabled={disabled}
				readOnly={readOnly}
			/>
		</div>
	);
});

export default AdminDateInput;
