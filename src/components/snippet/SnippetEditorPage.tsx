import dynamic from "next/dynamic";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import {
	fetchSnippetBootstrap,
	fetchSnippetDetail,
	refreshSnippetSession,
	requestSnippetClientApi,
	type SnippetBootstrapResponse,
	type SnippetSaveRequest,
	type SnippetSaveResponse,
} from "@/services/snippetApiService";
import styles from "./SnippetEditorPage.module.css";

const SnippetCodeEditor = dynamic(() => import("@/components/snippet/SnippetCodeEditor"), {
	ssr: false,
	loading: () => <div className={styles.editorLoading}>에디터를 불러오는 중입니다.</div>,
});

interface SnippetEditorPageProps {
	snippetNo?: string | null;
}

// 로그인 리다이렉트용 returnUrl을 생성합니다.
function resolveEditorReturnUrl(snippetNo?: string | null): string {
	if (typeof snippetNo === "string" && snippetNo.trim() !== "") {
		return `/snippet/edit/${encodeURIComponent(snippetNo.trim())}`;
	}
	return "/snippet/edit/new";
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

// 스니펫 등록/수정 화면을 렌더링합니다.
export default function SnippetEditorPage({ snippetNo }: SnippetEditorPageProps) {
	const router = useRouter();
	const isEditMode = typeof snippetNo === "string" && snippetNo.trim() !== "";
	const numericSnippetNo = isEditMode ? Number(snippetNo) : null;
	const [isInitializing, setIsInitializing] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [message, setMessage] = useState("");
	const [bootstrap, setBootstrap] = useState<SnippetBootstrapResponse | null>(null);
	const [form, setForm] = useState<SnippetSaveRequest>(createDefaultForm("plain_text"));

	// 페이지 진입 시 세션 복구와 bootstrap/상세 데이터를 조회합니다.
	useEffect(() => {
		let isCancelled = false;

		// 세션 복구 후 bootstrap과 편집 대상 데이터를 초기화합니다.
		const initializePage = async () => {
			const sessionResult = await refreshSnippetSession();
			if (isCancelled) {
				return;
			}
			if (!sessionResult.ok || !sessionResult.data?.authenticated) {
				await router.replace(`/snippet/login?returnUrl=${encodeURIComponent(resolveEditorReturnUrl(snippetNo))}`);
				return;
			}

			const bootstrapResult = await fetchSnippetBootstrap();
			if (isCancelled) {
				return;
			}
			if (!bootstrapResult.ok || !bootstrapResult.data) {
				setMessage(bootstrapResult.message || "에디터 초기 데이터를 불러오지 못했습니다.");
				setIsInitializing(false);
				return;
			}

			setBootstrap(bootstrapResult.data);
			const defaultLanguageCd = bootstrapResult.data.languageList[0]?.languageCd ?? "plain_text";

			if (!isEditMode || numericSnippetNo === null || Number.isNaN(numericSnippetNo)) {
				setForm(createDefaultForm(defaultLanguageCd));
				setIsInitializing(false);
				return;
			}

			const detailResult = await fetchSnippetDetail(numericSnippetNo);
			if (isCancelled) {
				return;
			}
			if (!detailResult.ok || !detailResult.data) {
				setMessage(detailResult.message || "수정할 스니펫을 불러오지 못했습니다.");
				setForm(createDefaultForm(defaultLanguageCd));
				setIsInitializing(false);
				return;
			}

			setForm({
				folderNo: detailResult.data.folderNo,
				languageCd: detailResult.data.languageCd,
				title: detailResult.data.title,
				summary: detailResult.data.summary,
				snippetBody: detailResult.data.snippetBody,
				memo: detailResult.data.memo,
				favoriteYn: detailResult.data.favoriteYn,
				tagNoList: detailResult.data.tagNoList,
			});
			setIsInitializing(false);
		};

		void initializePage();
		return () => {
			isCancelled = true;
		};
	}, [isEditMode, numericSnippetNo, router, snippetNo]);

	// 입력 필드 문자열 값을 갱신합니다.
	const handleFieldChange = (fieldName: "title" | "summary" | "memo" | "languageCd", value: string) => {
		setForm((previousForm) => ({
			...previousForm,
			[fieldName]: value,
		}));
	};

	// 폴더 선택 값을 갱신합니다.
	const handleFolderChange = (value: string) => {
		setForm((previousForm) => ({
			...previousForm,
			folderNo: value.trim() === "" ? null : Number(value),
		}));
	};

	// 즐겨찾기 체크박스를 갱신합니다.
	const handleFavoriteChange = (checked: boolean) => {
		setForm((previousForm) => ({
			...previousForm,
			favoriteYn: checked ? "Y" : "N",
		}));
	};

	// 태그 선택 상태를 토글합니다.
	const handleTagToggle = (tagNo: number, checked: boolean) => {
		setForm((previousForm) => ({
			...previousForm,
			tagNoList: checked
				? [...previousForm.tagNoList.filter((currentTagNo) => currentTagNo !== tagNo), tagNo]
				: previousForm.tagNoList.filter((currentTagNo) => currentTagNo !== tagNo),
		}));
	};

	// 스니펫 저장을 처리합니다.
	const handleSave = async () => {
		setIsSaving(true);
		setMessage("");

		const payload: SnippetSaveRequest = {
			...form,
			title: form.title.trim(),
			summary: form.summary && form.summary.trim() !== "" ? form.summary.trim() : null,
			memo: form.memo && form.memo.trim() !== "" ? form.memo.trim() : null,
			snippetBody: form.snippetBody,
		};

		const requestPath = isEditMode && numericSnippetNo !== null ? `/api/snippet/snippets/${numericSnippetNo}` : "/api/snippet/snippets";
		const requestMethod = isEditMode ? "PUT" : "POST";
		const result = await requestSnippetClientApi<SnippetSaveResponse>(requestPath, {
			method: requestMethod,
			body: payload,
		});

		if (!result.ok || !result.data) {
			setMessage(result.message || "스니펫 저장에 실패했습니다.");
			setIsSaving(false);
			return;
		}

		setMessage(result.data.message);
		setIsSaving(false);

		if (!isEditMode) {
			await router.replace(`/snippet/edit/${result.data.snippetNo}`);
		}
	};

	return (
		<>
			<Head>
				<title>{isEditMode ? "Snippet Edit" : "Snippet New"}</title>
				<meta name="description" content="react-resume 전용 스니펫 등록 및 수정 화면" />
			</Head>

			<div className={styles.pageShell}>
				<header className={styles.header}>
					<div>
						<p className={styles.eyebrow}>snippet editor</p>
						<h1 className={styles.title}>{isEditMode ? "저장된 스니펫을 다듬고 갱신하기" : "새로운 스니펫을 정리해서 보관하기"}</h1>
						<p className={styles.description}>
							제목, 언어, 폴더, 태그, 본문 코드, 메모를 함께 저장해 나중에 다시 찾기 쉬운 형태로 정리합니다.
						</p>
					</div>

					<div className={styles.headerActions}>
						<Link href="/snippet" className={styles.secondaryLink}>
							목록으로
						</Link>
						<button type="button" className={styles.primaryButton} onClick={handleSave} disabled={isSaving || isInitializing}>
							{isSaving ? "저장 중" : isEditMode ? "수정 저장" : "등록 저장"}
						</button>
					</div>
				</header>

				{message.trim() !== "" ? <p className={styles.messageBar}>{message}</p> : null}
				{isInitializing ? <p className={styles.loadingText}>에디터 화면을 준비하고 있습니다.</p> : null}

				{!isInitializing && bootstrap ? (
					<div className={styles.editorLayout}>
						<section className={styles.formPanel}>
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
						</section>

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
					</div>
				) : null}
			</div>
		</>
	);
}
