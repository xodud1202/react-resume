import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
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

interface SnippetEditorFormProps {
	mode: SnippetEditorMode;
	snippetNo?: number | null;
	bootstrap: SnippetBootstrapResponse;
	embedded?: boolean;
	onClose?: () => void;
	onSaved?: (response: SnippetSaveResponse) => Promise<void> | void;
	onSavingChange?: (saving: boolean) => void;
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
	const isEditMode = mode === "edit";
	const defaultLanguageCd = bootstrap.languageList[0]?.languageCd ?? "plain_text";
	const [isInitializing, setIsInitializing] = useState(isEditMode);
	const [isSaving, setIsSaving] = useState(false);
	const [isCreatingTag, setIsCreatingTag] = useState(false);
	const [message, setMessage] = useState("");
	const [form, setForm] = useState<SnippetSaveRequest>(createDefaultForm(defaultLanguageCd));
	const [availableTagList, setAvailableTagList] = useState<SnippetTag[]>(bootstrap.tagList);
	const [tagInputValue, setTagInputValue] = useState("");

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

	// 모드와 대상 번호에 맞춰 편집 폼을 초기화합니다.
	useEffect(() => {
		let isCancelled = false;

		// 신규 작성은 기본 폼을, 수정은 상세 조회 결과를 사용합니다.
		const initializeForm = async () => {
			setMessage("");
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
	}, [bootstrap.tagList, defaultLanguageCd, isEditMode, snippetNo]);

	// 문자열 입력 필드를 갱신합니다.
	const handleFieldChange = (fieldName: "title" | "summary" | "memo" | "languageCd", value: string) => {
		// 제목, 요약, 메모, 언어 선택값을 동일한 방식으로 갱신합니다.
		setForm((previousForm) => ({
			...previousForm,
			[fieldName]: value,
		}));
	};

	// 폴더 선택값을 갱신합니다.
	const handleFolderChange = (value: string) => {
		// 빈 값은 무폴더로 저장되도록 null로 정규화합니다.
		setForm((previousForm) => ({
			...previousForm,
			folderNo: value.trim() === "" ? null : Number(value),
		}));
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
		setMessage("");
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
			await router.replace(`/snippet/edit/${response.snippetNo}`);
			return;
		}

		if (isMountedRef.current) {
			setMessage(response.message);
		}
	};

	// 스니펫 저장을 처리합니다.
	const handleSave = async () => {
		setIsSaving(true);
		setMessage("");

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
	const normalizedTagInputKey = normalizeTagSearchKey(tagInputValue);
	const normalizedTagCreateValue = normalizeTagCreateName(tagInputValue);
	const matchedTag = findMatchedTag(availableTagList, tagInputValue);
	const selectedTagList = availableTagList.filter((tag) => form.tagNoList.includes(tag.tagNo));
	const filteredTagSuggestionList = filterTagSuggestionList(availableTagList, tagInputValue, form.tagNoList);

	return (
		<div className={shellClassName}>
			<header className={headerClassName}>
				<div className={styles.headerActions}>
					{embedded ? (
						<button
							type="button"
							className={styles.closeIconButton}
							onClick={onClose}
							disabled={isSaving}
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
								disabled={isSaving || isInitializing || isCreatingTag}
							>
								{isSaving ? "저장 중" : isEditMode ? "수정 저장" : "등록 저장"}
							</button>
						</>
					)}
				</div>
			</header>

			{message.trim() !== "" ? <p className={styles.messageBar}>{message}</p> : null}
			{isInitializing ? <p className={styles.loadingText}>에디터 화면을 준비하고 있습니다.</p> : null}

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

								<label className={styles.fieldGroup}>
									<span className={styles.fieldLabel}>언어</span>
									<select
										value={form.languageCd}
										onChange={(event) => handleFieldChange("languageCd", event.target.value)}
										className={styles.selectBox}
									>
										{bootstrap.languageList.map((language) => (
											<option key={language.languageCd} value={language.languageCd}>
												{language.languageNm}
											</option>
										))}
									</select>
								</label>

								<label className={styles.fieldGroup}>
									<span className={styles.fieldLabel}>폴더</span>
									<select value={form.folderNo ?? ""} onChange={(event) => handleFolderChange(event.target.value)} className={styles.selectBox}>
										<option value="">무폴더</option>
										{bootstrap.folderList.map((folder) => (
											<option key={folder.folderNo} value={folder.folderNo}>
												{folder.folderNm}
											</option>
										))}
									</select>
								</label>

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
									disabled={isSaving || isCreatingTag}
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
		</div>
	);
}
