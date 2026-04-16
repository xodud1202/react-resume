import styles from "./FeedbackLayer.module.css";

interface FeedbackLayerProps {
	// 자동으로 사라지는 성공 안내 문구입니다.
	successMessage: string;
	// 성공 안내 노출 여부입니다.
	isSuccessVisible: boolean;
	// 사용자가 직접 닫아야 하는 오류 문구입니다.
	errorMessage: string;
	// 진행 중인 비동기 작업의 로딩 레이어 노출 여부입니다.
	loadingVisible: boolean;
	// 현재 진행 중인 작업 설명입니다.
	loadingMessage: string;
	// 오류 안내를 닫습니다.
	onErrorClose: () => void;
}

// 공통 성공 토스트, 오류 박스, 로딩 레이어를 함께 렌더링합니다.
export default function FeedbackLayer({
	successMessage,
	isSuccessVisible,
	errorMessage,
	loadingVisible,
	loadingMessage,
	onErrorClose,
}: FeedbackLayerProps) {
	const normalizedSuccessMessage = successMessage.trim();
	const normalizedErrorMessage = errorMessage.trim();
	const normalizedLoadingMessage = loadingMessage.trim();
	const showSuccessToast = isSuccessVisible && normalizedSuccessMessage !== "";
	const showErrorDialog = normalizedErrorMessage !== "";
	const showLoadingOverlay = loadingVisible && normalizedLoadingMessage !== "" && !showErrorDialog;

	return (
		<>
			<div className={`${styles.successToast} ${showSuccessToast ? styles.successToastVisible : ""}`} aria-live="polite">
				{normalizedSuccessMessage}
			</div>

			{showLoadingOverlay ? (
				<div className={styles.blockingOverlay}>
					<div className={styles.dialogCard} role="status" aria-live="assertive">
						<div className={styles.loadingShell}>
							<div className={styles.loadingBadge} aria-hidden="true">
								<div className={styles.loadingSpinner} />
							</div>
							<div className={styles.loadingBarTrack} aria-hidden="true">
								<div className={styles.loadingBarValue} />
							</div>
							<p className={styles.loadingMessage}>{normalizedLoadingMessage}</p>
						</div>
					</div>
				</div>
			) : null}

			{showErrorDialog ? (
				<div className={styles.blockingOverlay}>
					<div className={styles.dialogCard} role="alertdialog" aria-modal="true" aria-labelledby="feedback-error-title">
						<div className={styles.dialogHeader}>
							<h2 id="feedback-error-title" className={styles.dialogTitle}>오류가 발생했습니다.</h2>
							<button type="button" className={styles.dialogCloseButton} onClick={onErrorClose} aria-label="오류 닫기">
								×
							</button>
						</div>
						<p className={styles.dialogMessage}>{normalizedErrorMessage}</p>
						<div className={styles.dialogActionRow}>
							<button type="button" className={styles.confirmButton} onClick={onErrorClose}>
								확인
							</button>
						</div>
					</div>
				</div>
			) : null}
		</>
	);
}
