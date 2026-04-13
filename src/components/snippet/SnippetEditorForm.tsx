import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import {
	fetchSnippetDetail,
	requestSnippetClientApi,
	type SnippetBootstrapResponse,
	type SnippetDetailResponse,
	type SnippetSaveRequest,
	type SnippetSaveResponse,
} from "@/services/snippetApiService";
import styles from "./SnippetEditorPage.module.css";

const SnippetCodeEditor = dynamic(() => import("@/components/snippet/SnippetCodeEditor"), {
	ssr: false,
	loading: () => <div className={styles.editorLoading}>에디터를 불러오는 중입니다.</div>,
});

export type SnippetEditorMode = "create" | "edit";

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
	const [message, setMessage] = useState("");
	const [form, setForm] = useState<SnippetSaveRequest>(createDefaultForm(defaultLanguageCd));

	// 컴포넌트 마운트 상태를 추적해 언마운트 후 상태 갱신을 방지합니다.
	useEffect(() => {
		return () => {
			isMountedRef.current = false;
		};
	}, []);

	// 저장 중 상태를 부모에게 전달합니다.
	useEffect(() => {
		// 모달 닫기 제어를 위해 현재 저장 중 여부를 상위에 알려줍니다.
		onSavingChange?.(isSaving);
	}, [isSaving, onSavingChange]);

	// 모드와 대상 번호에 맞춰 편집 폼을 초기화합니다.
	useEffect(() => {
		let isCancelled = false;

		// 신규 작성은 기본 폼을, 수정은 상세 조회 결과를 사용합니다.
		const initializeForm = async () => {
			setMessage("");

			if (!isEditMode) {
				setForm(createDefaultForm(defaultLanguageCd));
				setIsInitializing(false);
				return;
			}

			if (snippetNo === null || Number.isNaN(snippetNo)) {
				setMessage("수정할 스니펫을 확인해주세요.");
				setForm(createDefaultForm(defaultLanguageCd));
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
				setIsInitializing(false);
				return;
			}

			setForm(createFormFromDetail(detailResult.data));
			setIsInitializing(false);
		};

		void initializeForm();
		return () => {
			isCancelled = true;
		};
	}, [defaultLanguageCd, isEditMode, snippetNo]);

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

	// 태그 선택 상태를 토글합니다.
	const handleTagToggle = (tagNo: number, checked: boolean) => {
		// 체크 여부에 따라 태그 번호를 추가하거나 제거합니다.
		setForm((previousForm) => ({
			...previousForm,
			tagNoList: checked
				? [...previousForm.tagNoList.filter((currentTagNo) => currentTagNo !== tagNo), tagNo]
				: previousForm.tagNoList.filter((currentTagNo) => currentTagNo !== tagNo),
		}));
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
							<button type="button" className={styles.primaryButton} onClick={handleSave} disabled={isSaving || isInitializing}>
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
								<h2 className={styles.sectionTitle}>태그</h2>
								<div className={styles.tagGrid}>
									{bootstrap.tagList.length > 0 ? (
										bootstrap.tagList.map((tag) => (
											<label key={tag.tagNo} className={styles.tagOption}>
												<input
													type="checkbox"
													checked={form.tagNoList.includes(tag.tagNo)}
													onChange={(event) => handleTagToggle(tag.tagNo, event.target.checked)}
												/>
												<span>#{tag.tagNm}</span>
											</label>
										))
									) : (
										<p className={styles.helperText}>아직 등록된 태그가 없습니다. 메인 화면에서 먼저 태그를 추가할 수 있습니다.</p>
									)}
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
								<button type="button" className={`${styles.primaryButton} ${styles.embeddedSaveButton}`} onClick={handleSave} disabled={isSaving}>
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
