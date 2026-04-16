import { useCallback, useEffect, useRef, useState } from "react";

const SUCCESS_TOAST_DURATION_MS = 1450;
const FEEDBACK_FLASH_STORAGE_PREFIX = "react-resume:feedback-flash:";

// flash 메시지 저장소 키를 생성합니다.
function buildFeedbackFlashStorageKey(flashKey: string): string {
	return `${FEEDBACK_FLASH_STORAGE_PREFIX}${flashKey}`;
}

// 브라우저 sessionStorage에 1회성 성공 메시지를 저장합니다.
export function saveFeedbackFlashMessage(flashKey: string, message: string): void {
	if (typeof window === "undefined") {
		return;
	}

	const normalizedMessage = message.trim();
	if (normalizedMessage === "") {
		return;
	}
	window.sessionStorage.setItem(buildFeedbackFlashStorageKey(flashKey), normalizedMessage);
}

// 브라우저 sessionStorage에서 1회성 성공 메시지를 꺼내고 즉시 삭제합니다.
export function consumeFeedbackFlashMessage(flashKey: string): string {
	if (typeof window === "undefined") {
		return "";
	}

	const storageKey = buildFeedbackFlashStorageKey(flashKey);
	const storedMessage = window.sessionStorage.getItem(storageKey) ?? "";
	window.sessionStorage.removeItem(storageKey);
	return storedMessage.trim();
}

interface UseFeedbackLayerResult {
	// 현재 성공 토스트 문구입니다.
	successMessage: string;
	// 성공 토스트 노출 여부입니다.
	isSuccessVisible: boolean;
	// 현재 오류 문구입니다.
	errorMessage: string;
	// 성공 토스트를 표시합니다.
	showSuccess: (message: string) => void;
	// 오류 박스를 표시합니다.
	showError: (message: string) => void;
	// 오류 박스를 닫습니다.
	clearError: () => void;
	// 저장된 flash 성공 메시지를 읽어 토스트로 표시합니다.
	consumeFlashSuccess: (flashKey: string) => void;
}

// 공통 성공/오류 피드백 상태를 관리합니다.
export default function useFeedbackLayer(): UseFeedbackLayerResult {
	const [successMessage, setSuccessMessage] = useState("");
	const [isSuccessVisible, setIsSuccessVisible] = useState(false);
	const [errorMessage, setErrorMessage] = useState("");
	const successTimerRef = useRef<number | null>(null);

	// 성공 토스트 타이머를 정리합니다.
	const clearSuccessTimer = useCallback(() => {
		if (successTimerRef.current !== null) {
			window.clearTimeout(successTimerRef.current);
			successTimerRef.current = null;
		}
	}, []);

	// 성공 토스트를 자동 닫힘 규칙으로 표시합니다.
	const showSuccess = useCallback((message: string) => {
		const normalizedMessage = message.trim();
		if (normalizedMessage === "") {
			return;
		}

		clearSuccessTimer();
		setErrorMessage("");
		setSuccessMessage(normalizedMessage);
		setIsSuccessVisible(true);
		successTimerRef.current = window.setTimeout(() => {
			setIsSuccessVisible(false);
			successTimerRef.current = null;
		}, SUCCESS_TOAST_DURATION_MS);
	}, [clearSuccessTimer]);

	// 오류 박스를 표시하고 기존 성공 토스트는 닫습니다.
	const showError = useCallback((message: string) => {
		const normalizedMessage = message.trim();
		if (normalizedMessage === "") {
			setErrorMessage("");
			return;
		}

		clearSuccessTimer();
		setIsSuccessVisible(false);
		setSuccessMessage("");
		setErrorMessage(normalizedMessage);
	}, [clearSuccessTimer]);

	// 오류 박스를 닫습니다.
	const clearError = useCallback(() => {
		setErrorMessage("");
	}, []);

	// 저장된 flash 성공 메시지가 있으면 현재 화면에서 한 번만 토스트로 노출합니다.
	const consumeFlashSuccess = useCallback((flashKey: string) => {
		const flashMessage = consumeFeedbackFlashMessage(flashKey);
		if (flashMessage !== "") {
			showSuccess(flashMessage);
		}
	}, [showSuccess]);

	// 컴포넌트 종료 시 성공 토스트 타이머를 정리합니다.
	useEffect(() => {
		return () => {
			clearSuccessTimer();
		};
	}, [clearSuccessTimer]);

	return {
		successMessage,
		isSuccessVisible,
		errorMessage,
		showSuccess,
		showError,
		clearError,
		consumeFlashSuccess,
	};
}
