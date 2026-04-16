import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import FeedbackLayer from "@/components/common/FeedbackLayer";
import useFeedbackLayer, { saveFeedbackFlashMessage } from "@/components/common/useFeedbackLayer";
import {
	createSnippetTag,
	fetchSnippetDetail,
	requestSnippetClientApi,
	type SnippetBootstrapResponse,
	type SnippetDetailResponse,
	type SnippetSaveRequest,
	type SnippetSaveResponse,
	type SnippetTag,
} from "@/services/snippetApiService";
import styles from "./SnippetEditorPage.module.css";
import {
	filterTagSuggestionList,
	findMatchedTag,
	mergeAvailableTagList,
	normalizeTagCreateName,
	normalizeTagSearchKey,
} from "./snippetTagSearchUtils";

const SnippetCodeEditor = dynamic(() => import("@/components/snippet/SnippetCodeEditor"), {
	ssr: false,
	loading: () => <div className={styles.editorLoading}>에디터를 불러오는 중입니다.</div>,
});

export type SnippetEditorMode = "create" | "edit";
const DEFAULT_NEW_TAG_COLOR_HEX = "#3B7EA1";
// 단독 신규 저장 후 리다이렉트된 편집 화면에서 1회성 성공 토스트를 이어주기 위한 저장소 키입니다.
export const SNIPPET_EDITOR_SUCCESS_FLASH_KEY = "snippet-editor-success";

interface SelectMenuPosition {
	top: number;
	left: number;
	width: number;
}

// 트리거 버튼 기준으로 드롭다운 오버레이 위치를 계산합니다.
function resolveSelectMenuPosition(anchorElement: HTMLElement | null, minimumWidth: number): SelectMenuPosition | null {
	if (!anchorElement || typeof window === "undefined") {
		return null;
	}

	const anchorRect = anchorElement.getBoundingClientRect();
	const resolvedWidth = Math.max(anchorRect.width, minimumWidth);
	const maxLeft = Math.max(12, window.innerWidth - resolvedWidth - 12);
	return {
		top: anchorRect.bottom + 6,
		left: Math.min(Math.max(12, anchorRect.left), maxLeft),
		width: resolvedWidth,
	};
}

interface SnippetEditorFormProps {
	mode: SnippetEditorMode;
	snippetNo?: number | null;
	bootstrap: SnippetBootstrapResponse;
	embedded?: boolean;
	onClose?: () => void;
	onSaved?: (response: SnippetSaveResponse) => Promise<void> | void;
	onSavingChange?: (saving: boolean) => void;
}

// 에디터 화면에서 가장 우선순위가 높은 중앙 로딩 문구를 계산합니다.
function resolveSnippetEditorLoadingMessage(isInitializing: boolean, isSaving: boolean, isCreatingTag: boolean): string {
	if (isInitializing) {
		return "에디터 화면을 준비하고 있습니다.";
	}
	if (isSaving) {
		return "스니펫을 저장하고 있습니다.";
	}
	if (isCreatingTag) {
		return "태그를 생성하고 있습니다.";
	}
	return "";
}

// 편집 폼 기본값을 생성합니다.
function createDefaultForm(languageCd: string): SnippetSaveRequest {
	return {
		folderNo: null,
		languageCd,
		title: "",
		summary: null,
		snippetBody: "",
		memo: null,
		favoriteYn: "N",
		tagNoList: [],
	};
}

// 상세 응답을 저장 폼 형태로 변환합니다.
function createFormFromDetail(detail: SnippetDetailResponse): SnippetSaveRequest {
	return {
		folderNo: detail.folderNo,
		languageCd: detail.languageCd,
		title: detail.title,
		summary: detail.summary,
		snippetBody: detail.snippetBody,
		memo: detail.memo,
		favoriteYn: detail.favoriteYn,
		tagNoList: detail.tagNoList,
	};
}

// 등록/수정 모달과 fallback 편집 페이지가 함께 사용하는 스니펫 편집 본체를 렌더링합니다.
export default function SnippetEditorForm({
	mode,
	snippetNo = null,
	bootstrap,
	embedded = false,
	onClose,
	onSaved,
	onSavingChange,
}: SnippetEditorFormProps) {
	const router = useRouter();
	const isMountedRef = useRef(true);
	const { successMessage, isSuccessVisible, errorMessage, showSuccess, showError, clearError } = useFeedbackLayer();
	const isEditMode = mode === "edit";
	const defaultLanguageCd = bootstrap.languageList[0]?.languageCd ?? "plain_text";
	const [isInitializing, setIsInitializing] = useState(isEditMode);
	const [isSaving, setIsSaving] = useState(false);
	const [isCreatingTag, setIsCreatingTag] = useState(false);
	const [form, setForm] = useState<SnippetSaveRequest>(createDefaultForm(defaultLanguageCd));
	const [availableTagList, setAvailableTagList] = useState<SnippetTag[]>(bootstrap.tagList);
	const [tagInputValue, setTagInputValue] = useState("");
	const languageSelectRef = useRef<HTMLDivElement | null>(null);
	const folderSelectRef = useRef<HTMLDivElement | null>(null);
	const languageMenuRef = useRef<HTMLDivElement | null>(null);
	const folderMenuRef = useRef<HTMLDivElement | null>(null);
	const languageTriggerRef = useRef<HTMLButtonElement | null>(null);
	const folderTriggerRef = useRef<HTMLButtonElement | null>(null);
	const [isLanguageSelectOpen, setIsLanguageSelectOpen] = useState(false);
	const [isFolderSelectOpen, setIsFolderSelectOpen] = useState(false);
	const [languageMenuPosition, setLanguageMenuPosition] = useState<SelectMenuPosition | null>(null);
	const [folderMenuPosition, setFolderMenuPosition] = useState<SelectMenuPosition | null>(null);

	// 기존 message 호출을 중앙 오류 박스 제어로 변환합니다.
	const setMessage = useCallback((nextMessage: string) => {
		if (nextMessage.trim() === "") {
			clearError();
			return;
		}
		showError(nextMessage);
	}, [clearError, showError]);

	const blockingLoadingMessage = resolveSnippetEditorLoadingMessage(isInitializing, isSaving, isCreatingTag);

	// 컴포넌트 마운트 상태를 추적해 언마운트 후 상태 갱신을 방지합니다.
	useEffect(() => {
		return () => {
			isMountedRef.current = false;
		};
	}, []);

	// 저장 중 상태를 부모에게 전달합니다.
	useEffect(() => {
		// 모달 닫기 제어를 위해 현재 저장 중 여부를 상위에 알려줍니다.
		onSavingChange?.(isSaving || isCreatingTag);
	}, [isCreatingTag, isSaving, onSavingChange]);

	// 상위 bootstrap 태그 목록이 바뀌면 편집기 사용 가능 태그 목록을 동기화합니다.
	useEffect(() => {
		// 팝업이 열린 상태에서 외부 태그 목록이 갱신되면 최신 목록을 우선 반영합니다.
		setAvailableTagList((previousTagList) => {
			if (previousTagList.length === 0) {
				return bootstrap.tagList;
			}

			const mergedTagMap = new Map<number, SnippetTag>();
			bootstrap.tagList.forEach((tag) => {
				mergedTagMap.set(tag.tagNo, tag);
			});
			previousTagList.forEach((tag) => {
				if (!mergedTagMap.has(tag.tagNo)) {
					mergedTagMap.set(tag.tagNo, tag);
				}
			});
			return Array.from(mergedTagMap.values()).sort((leftTag, rightTag) => {
				if (leftTag.sortSeq !== rightTag.sortSeq) {
					return leftTag.sortSeq - rightTag.sortSeq;
				}
				return leftTag.tagNo - rightTag.tagNo;
			});
		});
	}, [bootstrap.tagList]);

	// 바깥 클릭과 ESC 입력으로 열린 드롭다운을 닫습니다.
	useEffect(() => {
		const handleDocumentMouseDown = (event: MouseEvent) => {
			const targetNode = event.target as Node;
			if (languageSelectRef.current?.contains(targetNode)) {
				return;
			}
			if (folderSelectRef.current?.contains(targetNode)) {
				return;
			}
			if (languageMenuRef.current?.contains(targetNode)) {
				return;
			}
			if (folderMenuRef.current?.contains(targetNode)) {
				return;
			}
			setIsLanguageSelectOpen(false);
			setIsFolderSelectOpen(false);
			setLanguageMenuPosition(null);
			setFolderMenuPosition(null);
		};

		const handleWindowKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setIsLanguageSelectOpen(false);
				setIsFolderSelectOpen(false);
				setLanguageMenuPosition(null);
				setFolderMenuPosition(null);
			}
		};

		document.addEventListener("mousedown", handleDocumentMouseDown);
		window.addEventListener("keydown", handleWindowKeyDown);
		return () => {
			document.removeEventListener("mousedown", handleDocumentMouseDown);
			window.removeEventListener("keydown", handleWindowKeyDown);
		};
	}, []);

	// 열린 드롭다운 위치를 리사이즈와 스크롤에 맞춰 갱신합니다.
	useEffect(() => {
		if (!isLanguageSelectOpen && !isFolderSelectOpen) {
			return;
		}

		const updateOverlayPosition = () => {
			if (isLanguageSelectOpen) {
				setLanguageMenuPosition(resolveSelectMenuPosition(languageTriggerRef.current, 220));
			}
			if (isFolderSelectOpen) {
				setFolderMenuPosition(resolveSelectMenuPosition(folderTriggerRef.current, 220));
			}
		};

		updateOverlayPosition();
		window.addEventListener("resize", updateOverlayPosition);
		document.addEventListener("scroll", updateOverlayPosition, true);
		return () => {
			window.removeEventListener("resize", updateOverlayPosition);
			document.removeEventListener("scroll", updateOverlayPosition, true);
		};
	}, [isFolderSelectOpen, isLanguageSelectOpen]);

	// 모드와 대상 번호에 맞춰 편집 폼을 초기화합니다.
	useEffect(() => {
		let isCancelled = false;

		// 신규 작성은 기본 폼을, 수정은 상세 조회 결과를 사용합니다.
		const initializeForm = async () => {
			setTagInputValue("");

			if (!isEditMode) {
				setForm(createDefaultForm(defaultLanguageCd));
				setAvailableTagList(bootstrap.tagList);
				setIsInitializing(false);
				return;
			}

			if (snippetNo === null || Number.isNaN(snippetNo)) {
				setMessage("수정할 스니펫을 확인해주세요.");
				setForm(createDefaultForm(defaultLanguageCd));
				setAvailableTagList(bootstrap.tagList);
				setIsInitializing(false);
				return;
			}

			setIsInitializing(true);
			const detailResult = await fetchSnippetDetail(snippetNo);
			if (isCancelled || !isMountedRef.current) {
				return;
			}

			if (!detailResult.ok || !detailResult.data) {
				setMessage(detailResult.message || "수정할 스니펫을 불러오지 못했습니다.");
				setForm(createDefaultForm(defaultLanguageCd));
				setAvailableTagList(bootstrap.tagList);
				setIsInitializing(false);
				return;
			}

			setForm(createFormFromDetail(detailResult.data));
			setAvailableTagList(bootstrap.tagList);
			setIsInitializing(false);
		};

		void initializeForm();
		return () => {
			isCancelled = true;
		};
	}, [bootstrap.tagList, defaultLanguageCd, isEditMode, setMessage, snippetNo]);

	// 문자열 입력 필드를 갱신합니다.
	const handleFieldChange = (fieldName: "title" | "summary" | "memo" | "languageCd", value: string) => {
		// 제목, 요약, 메모, 언어 선택값을 동일한 방식으로 갱신합니다.
		setForm((previousForm) => ({
			...previousForm,
			[fieldName]: value,
		}));
	};

	// 언어 선택값을 갱신하고 드롭다운을 닫습니다.
	const handleLanguageSelect = (languageCd: string) => {
		handleFieldChange("languageCd", languageCd);
		setIsLanguageSelectOpen(false);
		setLanguageMenuPosition(null);
	};

	// 폴더 선택값을 갱신합니다.
	const handleFolderSelect = (folderNo: number | null) => {
		// 무폴더는 null로 저장하고, 선택 후 드롭다운을 닫습니다.
		setForm((previousForm) => ({
			...previousForm,
			folderNo,
		}));
		setIsFolderSelectOpen(false);
		setFolderMenuPosition(null);
	};

	// 언어 드롭다운 열림 상태를 전환하고 현재 위치를 계산합니다.
	const handleLanguageTriggerClick = () => {
		if (isLanguageSelectOpen) {
			setIsLanguageSelectOpen(false);
			setLanguageMenuPosition(null);
			return;
		}

		setIsFolderSelectOpen(false);
		setFolderMenuPosition(null);
		setLanguageMenuPosition(resolveSelectMenuPosition(languageTriggerRef.current, 220));
		setIsLanguageSelectOpen(true);
	};

	// 폴더 드롭다운 열림 상태를 전환하고 현재 위치를 계산합니다.
	const handleFolderTriggerClick = () => {
		if (isFolderSelectOpen) {
			setIsFolderSelectOpen(false);
			setFolderMenuPosition(null);
			return;
		}

		setIsLanguageSelectOpen(false);
		setLanguageMenuPosition(null);
		setFolderMenuPosition(resolveSelectMenuPosition(folderTriggerRef.current, 220));
		setIsFolderSelectOpen(true);
	};

	// 즐겨찾기 체크 상태를 갱신합니다.
	const handleFavoriteChange = (checked: boolean) => {
		// 편집 폼에서 즉시 즐겨찾기 여부를 바꿀 수 있도록 상태를 반영합니다.
		setForm((previousForm) => ({
			...previousForm,
			favoriteYn: checked ? "Y" : "N",
		}));
	};

	// 선택한 태그를 추가합니다.
	const handleTagSelect = (tagNo: number) => {
		// 이미 선택된 태그는 유지하고, 새 태그만 목록 끝에 추가합니다.
		setForm((previousForm) => ({
			...previousForm,
			tagNoList: previousForm.tagNoList.includes(tagNo) ? previousForm.tagNoList : [...previousForm.tagNoList, tagNo],
		}));
		setTagInputValue("");
	};

	// 선택한 태그를 제거합니다.
	const handleTagRemove = (tagNo: number) => {
		// 선택 태그 칩에서 제거 버튼을 누르면 즉시 선택 목록에서 제외합니다.
		setForm((previousForm) => ({
			...previousForm,
			tagNoList: previousForm.tagNoList.filter((currentTagNo) => currentTagNo !== tagNo),
		}));
	};

	// 태그 입력값을 갱신합니다.
	const handleTagInputChange = (value: string) => {
		// 검색과 신규 생성 후보 계산에 사용할 원본 입력값을 그대로 유지합니다.
		setTagInputValue(value);
	};

	// 입력값 기준으로 새 태그를 생성하고 즉시 선택합니다.
	const handleCreateTagFromInput = async () => {
		// 공백과 # 접두사를 제거한 결과가 있을 때만 신규 태그를 생성합니다.
		const normalizedTagName = normalizeTagCreateName(tagInputValue);
		if (normalizedTagName === null || isCreatingTag) {
			return;
		}

		setIsCreatingTag(true);
		const result = await createSnippetTag({
			tagNm: normalizedTagName,
			colorHex: DEFAULT_NEW_TAG_COLOR_HEX,
			sortSeq: null,
		});

		if (!result.ok || !result.data) {
			if (isMountedRef.current) {
				setMessage(result.message || "태그 생성에 실패했습니다.");
				setIsCreatingTag(false);
			}
			return;
		}

		if (!isMountedRef.current) {
			return;
		}

		const createdTag = result.data;
		setAvailableTagList((previousTagList) => mergeAvailableTagList(previousTagList, createdTag));
		setForm((previousForm) => ({
			...previousForm,
			tagNoList: previousForm.tagNoList.includes(createdTag.tagNo) ? previousForm.tagNoList : [...previousForm.tagNoList, createdTag.tagNo],
		}));
		setTagInputValue("");
		setIsCreatingTag(false);
	};

	// 태그 입력창의 Enter 동작을 처리합니다.
	const handleTagInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
		// IME 조합 중 입력은 무시하고, Enter에서만 기존 태그 선택 또는 신규 생성을 시도합니다.
		if (event.key !== "Enter" || event.nativeEvent.isComposing) {
			return;
		}

		const normalizedTagName = normalizeTagCreateName(tagInputValue);
		if (normalizedTagName === null) {
			return;
		}

		event.preventDefault();
		const matchedTag = findMatchedTag(availableTagList, tagInputValue);
		if (matchedTag !== null) {
			handleTagSelect(matchedTag.tagNo);
			return;
		}
		void handleCreateTagFromInput();
	};

	// 저장 요청에 사용할 payload를 정리합니다.
	const createSavePayload = (): SnippetSaveRequest => {
		// 공백 정리와 nullable 문자열 정규화를 한 번에 처리합니다.
		return {
			...form,
			title: form.title.trim(),
			summary: form.summary && form.summary.trim() !== "" ? form.summary.trim() : null,
			memo: form.memo && form.memo.trim() !== "" ? form.memo.trim() : null,
			snippetBody: form.snippetBody,
		};
	};

	// 저장 성공 후 기본 이동 동작을 처리합니다.
	const handleDefaultSaveSuccess = async (response: SnippetSaveResponse) => {
		// popup이 아닌 fallback 페이지에서는 기존 흐름을 유지합니다.
		if (!isEditMode) {
			saveFeedbackFlashMessage(SNIPPET_EDITOR_SUCCESS_FLASH_KEY, response.message);
			await router.replace(`/snippet/edit/${response.snippetNo}`);
			return;
		}

		if (isMountedRef.current) {
			showSuccess(response.message);
		}
	};

	// 스니펫 저장을 처리합니다.
	const handleSave = async () => {
		setIsSaving(true);

		const requestPath = isEditMode && snippetNo !== null ? `/api/snippet/snippets/${snippetNo}` : "/api/snippet/snippets";
		const requestMethod = isEditMode ? "PUT" : "POST";
		const result = await requestSnippetClientApi<SnippetSaveResponse>(requestPath, {
			method: requestMethod,
			body: createSavePayload(),
		});

		if (!result.ok || !result.data) {
			if (isMountedRef.current) {
				setMessage(result.message || "스니펫 저장에 실패했습니다.");
				setIsSaving(false);
			}
			return;
		}

		try {
			// 상위에서 저장 후 갱신을 맡는 경우 콜백으로 위임합니다.
			if (onSaved) {
				await onSaved(result.data);
			} else {
				await handleDefaultSaveSuccess(result.data);
			}
		} finally {
			if (isMountedRef.current) {
				setIsSaving(false);
			}
		}
	};

	const shellClassName = embedded ? styles.embeddedEditorShell : styles.editorShell;
	const headerClassName = embedded ? styles.embeddedEditorHeader : styles.header;
	const layoutClassName = embedded ? styles.embeddedEditorLayout : styles.editorLayout;
	const formPanelClassName = `${styles.formPanel} ${embedded ? styles.embeddedFormPanel : ""}`.trim();
	const formScrollBodyClassName = `${styles.formScrollBody} ${embedded ? styles.embeddedFormScrollBody : ""}`.trim();
	const isInteractionBlocked = isInitializing || isSaving || isCreatingTag;
	const normalizedTagInputKey = normalizeTagSearchKey(tagInputValue);
	const normalizedTagCreateValue = normalizeTagCreateName(tagInputValue);
	const matchedTag = findMatchedTag(availableTagList, tagInputValue);
	const selectedLanguage = bootstrap.languageList.find((language) => language.languageCd === form.languageCd) ?? null;
	const selectedFolder = form.folderNo != null ? bootstrap.folderList.find((folder) => folder.folderNo === form.folderNo) ?? null : null;
	const selectedTagList = availableTagList.filter((tag) => form.tagNoList.includes(tag.tagNo));
	const filteredTagSuggestionList = filterTagSuggestionList(availableTagList, tagInputValue, form.tagNoList);
	const languageSelectMenuLayer =
		typeof document !== "undefined" && isLanguageSelectOpen && languageMenuPosition
			? createPortal(
					<div
						ref={languageMenuRef}
						className={styles.selectMenu}
						style={{ top: languageMenuPosition.top, left: languageMenuPosition.left, width: languageMenuPosition.width }}
						role="listbox"
						aria-label="언어 선택"
					>
						{bootstrap.languageList.map((language) => (
							<button
								key={language.languageCd}
								type="button"
								role="option"
								aria-selected={form.languageCd === language.languageCd}
								className={`${styles.selectOption} ${form.languageCd === language.languageCd ? styles.selectOptionActive : ""}`.trim()}
								onClick={() => handleLanguageSelect(language.languageCd)}
							>
								{language.languageNm}
							</button>
						))}
					</div>,
					document.body,
				)
			: null;
	const folderSelectMenuLayer =
		typeof document !== "undefined" && isFolderSelectOpen && folderMenuPosition
			? createPortal(
					<div
						ref={folderMenuRef}
						className={styles.selectMenu}
						style={{ top: folderMenuPosition.top, left: folderMenuPosition.left, width: folderMenuPosition.width }}
						role="listbox"
						aria-label="폴더 선택"
					>
						<button
							type="button"
							role="option"
							aria-selected={form.folderNo === null}
							className={`${styles.selectOption} ${form.folderNo === null ? styles.selectOptionActive : ""}`.trim()}
							onClick={() => handleFolderSelect(null)}
						>
							무폴더
						</button>
						{bootstrap.folderList.map((folder) => (
							<button
								key={folder.folderNo}
								type="button"
								role="option"
								aria-selected={form.folderNo === folder.folderNo}
								className={`${styles.selectOption} ${form.folderNo === folder.folderNo ? styles.selectOptionActive : ""}`.trim()}
								onClick={() => handleFolderSelect(folder.folderNo)}
							>
								{folder.folderNm}
							</button>
						))}
					</div>,
					document.body,
				)
			: null;

	return (
		<div className={shellClassName}>
			<FeedbackLayer
				successMessage={successMessage}
				isSuccessVisible={isSuccessVisible}
				errorMessage={errorMessage}
				loadingVisible={blockingLoadingMessage !== ""}
				loadingMessage={blockingLoadingMessage}
				onErrorClose={clearError}
			/>
			<header className={headerClassName}>
				<div className={styles.headerActions}>
					{embedded ? (
						<button
							type="button"
							className={styles.closeIconButton}
							onClick={onClose}
							disabled={isInteractionBlocked}
							aria-label="닫기"
						>
							×
						</button>
					) : (
						<>
							<Link href="/snippet" className={styles.secondaryLink}>
								목록으로
							</Link>
							<button
								type="button"
								className={styles.primaryButton}
								onClick={handleSave}
								disabled={isInteractionBlocked}
							>
								{isSaving ? "저장 중" : isEditMode ? "수정 저장" : "등록 저장"}
							</button>
						</>
					)}
				</div>
			</header>

			{!isInitializing ? (
				<div className={layoutClassName}>
					<section className={formPanelClassName}>
						<div className={formScrollBodyClassName}>
							<div className={styles.formGrid}>
								<label className={styles.fieldGroup}>
									<span className={styles.fieldLabel}>제목</span>
									<input
										type="text"
										value={form.title}
										onChange={(event) => handleFieldChange("title", event.target.value)}
										maxLength={150}
										className={styles.textInput}
										placeholder="예: 주문 취소 금액 계산 SQL"
									/>
								</label>

								<div className={styles.fieldGroup} ref={languageSelectRef}>
									<span className={styles.fieldLabel}>언어</span>
									<button
										ref={languageTriggerRef}
										type="button"
										className={styles.selectTrigger}
										onClick={handleLanguageTriggerClick}
										aria-haspopup="listbox"
										aria-expanded={isLanguageSelectOpen}
										aria-label="언어 선택"
									>
										<span className={styles.selectTriggerValue}>{selectedLanguage?.languageNm ?? form.languageCd}</span>
										<span className={styles.selectTriggerChevron} aria-hidden="true">
											▾
										</span>
									</button>
								</div>

								<div className={styles.fieldGroup} ref={folderSelectRef}>
									<span className={styles.fieldLabel}>폴더</span>
									<button
										ref={folderTriggerRef}
										type="button"
										className={styles.selectTrigger}
										onClick={handleFolderTriggerClick}
										aria-haspopup="listbox"
										aria-expanded={isFolderSelectOpen}
										aria-label="폴더 선택"
									>
										<span className={styles.selectTriggerValue}>{selectedFolder?.folderNm ?? "무폴더"}</span>
										<span className={styles.selectTriggerChevron} aria-hidden="true">
											▾
										</span>
									</button>
								</div>

								<label className={styles.checkboxField}>
									<input type="checkbox" checked={form.favoriteYn === "Y"} onChange={(event) => handleFavoriteChange(event.target.checked)} />
									<span>즐겨찾기에 고정</span>
								</label>

								<label className={`${styles.fieldGroup} ${styles.fullWidth}`}>
									<span className={styles.fieldLabel}>요약</span>
									<textarea
										value={form.summary ?? ""}
										onChange={(event) => handleFieldChange("summary", event.target.value)}
										maxLength={500}
										className={styles.textArea}
										placeholder="이 스니펫을 언제, 왜 다시 쓰는지 간단히 적어주세요"
									/>
								</label>
							</div>

							<section className={styles.tagSection}>
								<div className={styles.tagSectionHeader}>
									<h2 className={styles.sectionTitle}>태그</h2>
									<span className={styles.tagCounter}>{form.tagNoList.length}개 선택</span>
								</div>

								<div className={styles.selectedTagList}>
									{selectedTagList.length > 0 ? (
										selectedTagList.map((tag) => (
											<span key={tag.tagNo} className={styles.selectedTagChip}>
												<span className={styles.selectedTagChipLabel}>#{tag.tagNm}</span>
												<button
													type="button"
													className={styles.selectedTagChipRemove}
													onClick={() => handleTagRemove(tag.tagNo)}
													aria-label={`태그 ${tag.tagNm} 제거`}
												>
													×
												</button>
											</span>
										))
									) : (
										<p className={styles.helperText}>선택된 태그가 없습니다. 태그를 입력하고 Enter를 눌러 바로 추가할 수 있습니다.</p>
									)}
								</div>

								<div className={styles.tagComposer}>
									<input
										type="text"
										value={tagInputValue}
										onChange={(event) => handleTagInputChange(event.target.value)}
										onKeyDown={handleTagInputKeyDown}
										className={`${styles.textInput} ${styles.tagTextInput}`.trim()}
										placeholder="#태그를 입력하고 Enter를 눌러 추가하세요"
									/>

									{normalizedTagInputKey !== "" ? (
										<div className={styles.tagSuggestionPanel}>
											{filteredTagSuggestionList.map((tag) => (
												<button
													key={tag.tagNo}
													type="button"
													className={styles.tagSuggestionButton}
													onClick={() => handleTagSelect(tag.tagNo)}
												>
													<span className={styles.tagSuggestionName}>#{tag.tagNm}</span>
													<span className={styles.tagSuggestionHint}>기존 태그 선택</span>
												</button>
											))}

											{matchedTag === null && normalizedTagCreateValue !== null ? (
												<button
													type="button"
													className={`${styles.tagSuggestionButton} ${styles.tagSuggestionCreateButton}`.trim()}
													onClick={() => {
														void handleCreateTagFromInput();
													}}
													disabled={isCreatingTag}
												>
													<span className={styles.tagSuggestionName}>#{normalizedTagCreateValue}</span>
													<span className={styles.tagSuggestionHint}>{isCreatingTag ? "생성 중" : "새 태그 생성"}</span>
												</button>
											) : null}

											{matchedTag !== null && form.tagNoList.includes(matchedTag.tagNo) ? (
												<p className={styles.tagSuggestionHelper}>이미 선택된 태그입니다.</p>
											) : null}
										</div>
									) : null}
								</div>
							</section>

							<section className={styles.editorSection}>
								<h2 className={styles.sectionTitle}>코드 본문</h2>
								<SnippetCodeEditor
									value={form.snippetBody}
									languageCd={form.languageCd}
									onChange={(value) => {
										// 코드 본문은 문자열 전체를 그대로 저장 폼에 반영합니다.
										setForm((previousForm) => ({
											...previousForm,
											snippetBody: value,
										}));
									}}
								/>
							</section>

							<section className={styles.memoSection}>
								<h2 className={styles.sectionTitle}>메모</h2>
								<textarea
									value={form.memo ?? ""}
									onChange={(event) => handleFieldChange("memo", event.target.value)}
									className={styles.memoArea}
									placeholder="적용 조건, 주의사항, 관련 링크, 운영 메모를 적어둘 수 있습니다"
								/>
							</section>
						</div>

						{embedded ? (
							<div className={styles.formActionFooter}>
								<button
									type="button"
									className={`${styles.primaryButton} ${styles.embeddedSaveButton}`}
									onClick={handleSave}
									disabled={isInteractionBlocked}
								>
									{isSaving ? "저장 중" : isEditMode ? "수정 저장" : "등록 저장"}
								</button>
							</div>
						) : null}
					</section>

					{!embedded ? (
						<aside className={styles.sidePanel}>
							<section className={styles.sideCard}>
								<p className={styles.sideEyebrow}>작성 팁</p>
								<ul className={styles.tipList}>
									<li>제목은 나중에 검색하기 쉬운 키워드 중심으로 적습니다.</li>
									<li>요약에는 사용 시점이나 대상 화면을 함께 적어두면 다시 찾기 쉽습니다.</li>
									<li>메모에는 실행 전 주의사항이나 필요한 파라미터를 남겨두는 것이 좋습니다.</li>
								</ul>
							</section>

							<section className={styles.sideCard}>
								<p className={styles.sideEyebrow}>현재 상태</p>
								<p className={styles.sideValue}>{form.title.trim() === "" ? "제목 미입력" : form.title}</p>
								<p className={styles.sideMeta}>언어: {form.languageCd}</p>
								<p className={styles.sideMeta}>태그 수: {form.tagNoList.length}개</p>
								<p className={styles.sideMeta}>즐겨찾기: {form.favoriteYn === "Y" ? "설정" : "미설정"}</p>
							</section>
						</aside>
					) : null}
				</div>
			) : null}
			{languageSelectMenuLayer}
			{folderSelectMenuLayer}
		</div>
	);
}
