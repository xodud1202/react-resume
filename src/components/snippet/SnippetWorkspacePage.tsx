import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState, type FormEvent, type MouseEvent as ReactMouseEvent } from "react";
import {
	fetchSnippetBootstrap,
	fetchSnippetDetail,
	fetchSnippetList,
	logoutSnippet,
	markSnippetCopied,
	markSnippetViewed,
	refreshSnippetSession,
	requestSnippetClientApi,
	type SnippetBootstrapResponse,
	type SnippetDetailResponse,
	type SnippetFolder,
	type SnippetLanguage,
	type SnippetListResponse,
	type SnippetSummary,
	type SnippetTag,
} from "@/services/snippetApiService";
import styles from "./SnippetWorkspacePage.module.css";

type SnippetQuickFilter = "all" | "favorite" | "duplicate";
type SnippetSortBy = "created_desc" | "updated_desc" | "viewed_desc" | "copied_desc" | "copy_count_desc" | "title_asc";
type RecentPanelType = "viewed" | "copied" | null;

interface SnippetListReloadOptions {
	q?: string;
	folderNo?: number | null;
	tagNo?: number | null;
	languageCd?: string;
	includeBodyYn?: string;
	sortBy?: SnippetSortBy;
	quickFilter?: SnippetQuickFilter;
}

const QUICK_FILTER_OPTION_LIST: Array<{ value: SnippetQuickFilter; label: string }> = [
	{ value: "all", label: "전체" },
	{ value: "favorite", label: "즐겨찾기" },
	{ value: "duplicate", label: "중복 후보" },
];

const SORT_OPTION_LIST: Array<{ value: SnippetSortBy; label: string }> = [
	{ value: "created_desc", label: "등록일순" },
	{ value: "updated_desc", label: "수정일순" },
	{ value: "viewed_desc", label: "최근 조회순" },
	{ value: "copied_desc", label: "최근 복사순" },
	{ value: "copy_count_desc", label: "복사 수순" },
	{ value: "title_asc", label: "제목순" },
];

// 비어 있는 문자열을 목록용 기본 문구로 치환합니다.
function resolveCompactText(value: string | null, fallbackText: string): string {
	if (!value || value.trim() === "") {
		return fallbackText;
	}
	return value.trim();
}

// 코드 복사 버튼 아이콘을 렌더링합니다.
function CopyIcon() {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className={styles.copyIcon} fill="none">
			<rect x="9" y="9" width="10" height="10" rx="2.2" />
			<path d="M15 9V7.5C15 6.12 13.88 5 12.5 5h-5C6.12 5 5 6.12 5 7.5v5C5 13.88 6.12 15 7.5 15H9" />
		</svg>
	);
}

// 스니펫 메인 작업 화면을 렌더링합니다.
export default function SnippetWorkspacePage() {
	const router = useRouter();
	const feedbackToastTimerRef = useRef<number | null>(null);
	const recentPanelRef = useRef<HTMLDivElement | null>(null);
	const [isInitializing, setIsInitializing] = useState(true);
	const [isListLoading, setIsListLoading] = useState(false);
	const [isActionPending, setIsActionPending] = useState(false);
	const [isCodeHovered, setIsCodeHovered] = useState(false);
	const [message, setMessage] = useState("");
	const [feedbackToastMessage, setFeedbackToastMessage] = useState("");
	const [isFeedbackToastVisible, setIsFeedbackToastVisible] = useState(false);
	const [bootstrap, setBootstrap] = useState<SnippetBootstrapResponse | null>(null);
	const [listResponse, setListResponse] = useState<SnippetListResponse | null>(null);
	const [detail, setDetail] = useState<SnippetDetailResponse | null>(null);
	const [selectedSnippetNo, setSelectedSnippetNo] = useState<number | null>(null);
	const [searchInput, setSearchInput] = useState("");
	const [searchKeyword, setSearchKeyword] = useState("");
	const [selectedFolderNo, setSelectedFolderNo] = useState<number | null>(null);
	const [selectedTagNo, setSelectedTagNo] = useState<number | null>(null);
	const [selectedLanguageCd, setSelectedLanguageCd] = useState("");
	const [includeBodyYn, setIncludeBodyYn] = useState("N");
	const [selectedSortBy, setSelectedSortBy] = useState<SnippetSortBy>("created_desc");
	const [selectedQuickFilter, setSelectedQuickFilter] = useState<SnippetQuickFilter>("all");
	const [openRecentPanel, setOpenRecentPanel] = useState<RecentPanelType>(null);

	// 중앙 알림 토스트 타이머를 정리합니다.
	const clearFeedbackToastTimer = () => {
		if (feedbackToastTimerRef.current !== null) {
			window.clearTimeout(feedbackToastTimerRef.current);
			feedbackToastTimerRef.current = null;
		}
	};

	// 화면 중앙 공통 알림 토스트를 잠깐 표시합니다.
	const showFeedbackToast = (toastMessage: string) => {
		clearFeedbackToastTimer();
		setFeedbackToastMessage(toastMessage);
		setIsFeedbackToastVisible(true);
		feedbackToastTimerRef.current = window.setTimeout(() => {
			setIsFeedbackToastVisible(false);
			feedbackToastTimerRef.current = null;
		}, 1450);
	};

	// 목록 응답을 반영하면서 선택 상태를 가능한 범위에서 유지합니다.
	const applyListResponse = (nextListResponse: SnippetListResponse) => {
		setListResponse(nextListResponse);
		setSelectedSnippetNo((previousSnippetNo) => {
			if (previousSnippetNo !== null && nextListResponse.list.some((item) => item.snippetNo === previousSnippetNo)) {
				return previousSnippetNo;
			}
			return nextListResponse.list.length > 0 ? nextListResponse.list[0].snippetNo : null;
		});
	};

	// 페이지 종료 시 토스트 타이머를 정리합니다.
	useEffect(() => {
		return () => {
			clearFeedbackToastTimer();
		};
	}, []);

	// 바깥 영역을 클릭하면 최근 사용 패널을 닫습니다.
	useEffect(() => {
		const handleDocumentMouseDown = (event: MouseEvent) => {
			if (!recentPanelRef.current) {
				return;
			}

			if (!recentPanelRef.current.contains(event.target as Node)) {
				setOpenRecentPanel(null);
			}
		};

		document.addEventListener("mousedown", handleDocumentMouseDown);
		return () => {
			document.removeEventListener("mousedown", handleDocumentMouseDown);
		};
	}, []);

	// 선택 스니펫이 바뀌면 코드 hover 상태를 초기화합니다.
	useEffect(() => {
		setIsCodeHovered(false);
	}, [selectedSnippetNo]);

	// 페이지 진입 시 세션 복구와 bootstrap/목록 초기 조회를 수행합니다.
	useEffect(() => {
		let isCancelled = false;

		// 로그인 세션을 복구하고 초기 데이터를 조회합니다.
		const initializePage = async () => {
			const sessionResult = await refreshSnippetSession();
			if (isCancelled) {
				return;
			}

			if (!sessionResult.ok || !sessionResult.data?.authenticated) {
				await router.replace("/snippet/login?returnUrl=%2Fsnippet");
				return;
			}

			const bootstrapResult = await fetchSnippetBootstrap();
			if (isCancelled) {
				return;
			}

			if (!bootstrapResult.ok || !bootstrapResult.data) {
				setMessage(bootstrapResult.message || "스니펫 초기 데이터를 불러오지 못했습니다.");
				setIsInitializing(false);
				return;
			}

			setBootstrap(bootstrapResult.data);
			setIsInitializing(false);
			await loadSnippetList();
		};

		void initializePage();
		return () => {
			isCancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// 선택된 스니펫 번호가 바뀌면 상세 데이터를 다시 조회하고 조회 이력을 남깁니다.
	useEffect(() => {
		let isCancelled = false;

		// 현재 선택된 스니펫 상세를 조회하고 조회 이력을 갱신합니다.
		const loadDetail = async () => {
			if (selectedSnippetNo === null) {
				setDetail(null);
				return;
			}

			const detailResult = await fetchSnippetDetail(selectedSnippetNo);
			if (isCancelled) {
				return;
			}

			if (!detailResult.ok || !detailResult.data) {
				setMessage(detailResult.message || "스니펫 상세를 불러오지 못했습니다.");
				setDetail(null);
				return;
			}

			setDetail(detailResult.data);

			const viewedResult = await markSnippetViewed(selectedSnippetNo);
			if (isCancelled) {
				return;
			}

			if (!viewedResult.ok) {
				setMessage(viewedResult.message || "조회 이력을 갱신하지 못했습니다.");
				return;
			}

			await reloadBootstrap();
			if (isCancelled) {
				return;
			}

			await loadSnippetList();
			if (isCancelled) {
				return;
			}

			const refreshedDetailResult = await fetchSnippetDetail(selectedSnippetNo);
			if (isCancelled) {
				return;
			}

			if (refreshedDetailResult.ok && refreshedDetailResult.data) {
				setDetail(refreshedDetailResult.data);
			}
		};

		void loadDetail();
		return () => {
			isCancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedSnippetNo]);

	// 현재 필터 기준으로 스니펫 목록을 다시 조회합니다.
	const loadSnippetList = async (options: SnippetListReloadOptions = {}) => {
		const resolvedQ = typeof options.q === "string" ? options.q : searchKeyword;
		const resolvedFolderNo = Object.prototype.hasOwnProperty.call(options, "folderNo") ? options.folderNo ?? null : selectedFolderNo;
		const resolvedTagNo = Object.prototype.hasOwnProperty.call(options, "tagNo") ? options.tagNo ?? null : selectedTagNo;
		const resolvedLanguageCd = typeof options.languageCd === "string" ? options.languageCd : selectedLanguageCd;
		const resolvedIncludeBodyYn = typeof options.includeBodyYn === "string" ? options.includeBodyYn : includeBodyYn;
		const resolvedSortBy = typeof options.sortBy === "string" ? options.sortBy : selectedSortBy;
		const resolvedQuickFilter = typeof options.quickFilter === "string" ? options.quickFilter : selectedQuickFilter;

		setIsListLoading(true);
		const result = await fetchSnippetList({
			q: resolvedQ,
			folderNo: resolvedFolderNo,
			tagNo: resolvedTagNo,
			languageCd: resolvedLanguageCd,
			includeBodyYn: resolvedIncludeBodyYn,
			sortBy: resolvedSortBy,
			quickFilter: resolvedQuickFilter,
			page: 1,
			size: 40,
		});

		if (!result.ok || !result.data) {
			setMessage(result.message || "스니펫 목록 조회에 실패했습니다.");
			setListResponse({
				list: [],
				totalCount: 0,
				page: 1,
				size: 40,
			});
			setSelectedSnippetNo(null);
			setIsListLoading(false);
			return;
		}

		applyListResponse(result.data);
		setIsListLoading(false);
	};

	// bootstrap 데이터를 다시 읽어 보조 목록을 갱신합니다.
	const reloadBootstrap = async () => {
		const result = await fetchSnippetBootstrap();
		if (!result.ok || !result.data) {
			setMessage(result.message || "보조 데이터를 다시 불러오지 못했습니다.");
			return;
		}
		setBootstrap(result.data);
	};

	// 현재 선택된 스니펫 상세를 다시 읽어 상세 패널을 최신 상태로 맞춥니다.
	const reloadDetail = async (snippetNo: number) => {
		const result = await fetchSnippetDetail(snippetNo);
		if (!result.ok || !result.data) {
			setMessage(result.message || "스니펫 상세를 다시 불러오지 못했습니다.");
			return;
		}
		setDetail(result.data);
	};

	// 폴더 선택 필터를 토글합니다.
	const handleFolderSelect = async (folderNo: number | null) => {
		const nextFolderNo = selectedFolderNo === folderNo ? null : folderNo;
		setSelectedFolderNo(nextFolderNo);
		await loadSnippetList({ folderNo: nextFolderNo });
	};

	// 태그 선택 필터를 토글합니다.
	const handleTagSelect = async (tagNo: number | null) => {
		const nextTagNo = selectedTagNo === tagNo ? null : tagNo;
		setSelectedTagNo(nextTagNo);
		await loadSnippetList({ tagNo: nextTagNo });
	};

	// 언어 필터를 변경합니다.
	const handleLanguageChange = async (nextLanguageCd: string) => {
		setSelectedLanguageCd(nextLanguageCd);
		await loadSnippetList({ languageCd: nextLanguageCd });
	};

	// 본문 포함 검색 여부를 변경합니다.
	const handleIncludeBodyChange = async (checked: boolean) => {
		const nextIncludeBodyYn = checked ? "Y" : "N";
		setIncludeBodyYn(nextIncludeBodyYn);
		await loadSnippetList({ includeBodyYn: nextIncludeBodyYn });
	};

	// 정렬 기준을 변경합니다.
	const handleSortChange = async (nextSortBy: SnippetSortBy) => {
		setSelectedSortBy(nextSortBy);
		await loadSnippetList({ sortBy: nextSortBy });
	};

	// 퀵필터를 변경합니다.
	const handleQuickFilterChange = async (nextQuickFilter: SnippetQuickFilter) => {
		setSelectedQuickFilter(nextQuickFilter);
		setOpenRecentPanel(null);
		await loadSnippetList({ quickFilter: nextQuickFilter });
	};

	// 검색 폼을 제출합니다.
	const handleSearchSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const nextKeyword = searchInput.trim();
		setSearchKeyword(nextKeyword);
		await loadSnippetList({ q: nextKeyword });
	};

	// 최근 사용 패널을 토글합니다.
	const handleRecentPanelToggle = (panelType: Exclude<RecentPanelType, null>) => {
		setOpenRecentPanel((previousPanelType) => (previousPanelType === panelType ? null : panelType));
	};

	// 최근 사용 목록에서 스니펫을 열고 패널을 닫습니다.
	const handleRecentSnippetOpen = (snippetNo: number, event: ReactMouseEvent<HTMLButtonElement>) => {
		event.preventDefault();
		setSelectedSnippetNo(snippetNo);
		setOpenRecentPanel(null);
	};

	// 코드 복사를 처리하고 상세/목록을 최신 상태로 갱신합니다.
	const handleCopySnippet = async (snippet: SnippetDetailResponse) => {
		try {
			await navigator.clipboard.writeText(snippet.snippetBody);

			const copiedResult = await markSnippetCopied(snippet.snippetNo);
			if (!copiedResult.ok) {
				setMessage(copiedResult.message || "복사 이력을 갱신하지 못했습니다.");
				return;
			}

			await reloadBootstrap();
			await loadSnippetList();
			await reloadDetail(snippet.snippetNo);
			setSelectedSnippetNo(snippet.snippetNo);
			setMessage("");
			showFeedbackToast("복사되었습니다.");
		} catch {
			setMessage("클립보드 복사에 실패했습니다.");
		}
	};

	// 선택된 스니펫의 즐겨찾기 여부를 토글합니다.
	const handleFavoriteToggle = async (snippet: SnippetSummary | SnippetDetailResponse) => {
		setIsActionPending(true);
		const nextFavoriteYn = snippet.favoriteYn === "Y" ? "N" : "Y";

		const result = await requestSnippetClientApi<{ message: string }>(`/api/snippet/snippets/${snippet.snippetNo}/favorite`, {
			method: "PATCH",
			body: {
				favoriteYn: nextFavoriteYn,
			},
		});

		if (!result.ok) {
			setMessage(result.message || "즐겨찾기 상태를 변경하지 못했습니다.");
			setIsActionPending(false);
			return;
		}

		setMessage("");
		showFeedbackToast("즐겨찾기 상태를 변경했습니다.");
		await reloadBootstrap();
		await loadSnippetList();
		await reloadDetail(snippet.snippetNo);
		setSelectedSnippetNo(snippet.snippetNo);
		setIsActionPending(false);
	};

	// 스니펫 삭제를 처리합니다.
	const handleDeleteSnippet = async (snippetNo: number) => {
		if (!window.confirm("선택한 스니펫을 삭제하시겠습니까?")) {
			return;
		}

		setIsActionPending(true);
		const result = await requestSnippetClientApi<{ message: string }>(`/api/snippet/snippets/${snippetNo}`, {
			method: "DELETE",
		});

		if (!result.ok) {
			setMessage(result.message || "스니펫을 삭제하지 못했습니다.");
			setIsActionPending(false);
			return;
		}

		setMessage("");
		showFeedbackToast("스니펫을 삭제했습니다.");
		setDetail(null);
		await reloadBootstrap();
		await loadSnippetList();
		setIsActionPending(false);
	};

	// 폴더를 추가합니다.
	const handleCreateFolder = async () => {
		const folderNm = window.prompt("새 폴더명을 입력해주세요.");
		if (!folderNm || folderNm.trim() === "") {
			return;
		}

		setIsActionPending(true);
		const result = await requestSnippetClientApi<SnippetFolder>("/api/snippet/folders", {
			method: "POST",
			body: {
				folderNm: folderNm.trim(),
				colorHex: "#D96C47",
			},
		});

		if (!result.ok) {
			setMessage(result.message || "폴더를 추가하지 못했습니다.");
			setIsActionPending(false);
			return;
		}

		setMessage("");
		showFeedbackToast("폴더를 추가했습니다.");
		await reloadBootstrap();
		setIsActionPending(false);
	};

	// 언어를 추가합니다.
	const handleCreateLanguage = async () => {
		const languageNm = window.prompt("새 언어명을 입력해주세요.");
		if (!languageNm || languageNm.trim() === "") {
			return;
		}

		setIsActionPending(true);
		const result = await requestSnippetClientApi<SnippetLanguage>("/api/snippet/languages", {
			method: "POST",
			body: {
				languageNm: languageNm.trim(),
			},
		});

		if (!result.ok) {
			setMessage(result.message || "언어를 추가하지 못했습니다.");
			setIsActionPending(false);
			return;
		}

		setMessage("");
		showFeedbackToast("언어를 추가했습니다.");
		await reloadBootstrap();
		setIsActionPending(false);
	};

	// 태그를 추가합니다.
	const handleCreateTag = async () => {
		const tagNm = window.prompt("새 태그명을 입력해주세요.");
		if (!tagNm || tagNm.trim() === "") {
			return;
		}

		setIsActionPending(true);
		const result = await requestSnippetClientApi<SnippetTag>("/api/snippet/tags", {
			method: "POST",
			body: {
				tagNm: tagNm.trim(),
				colorHex: "#3B7EA1",
			},
		});

		if (!result.ok) {
			setMessage(result.message || "태그를 추가하지 못했습니다.");
			setIsActionPending(false);
			return;
		}

		setMessage("");
		showFeedbackToast("태그를 추가했습니다.");
		await reloadBootstrap();
		setIsActionPending(false);
	};

	// 폴더 삭제를 처리합니다.
	const handleDeleteFolder = async (folder: SnippetFolder) => {
		if (!window.confirm(`"${folder.folderNm}" 폴더를 삭제하시겠습니까? 연결된 스니펫은 무폴더 상태로 유지됩니다.`)) {
			return;
		}

		setIsActionPending(true);
		const result = await requestSnippetClientApi<{ message: string }>(`/api/snippet/folders/${folder.folderNo}`, {
			method: "DELETE",
		});

		if (!result.ok) {
			setMessage(result.message || "폴더를 삭제하지 못했습니다.");
			setIsActionPending(false);
			return;
		}

		if (selectedFolderNo === folder.folderNo) {
			setSelectedFolderNo(null);
		}

		setMessage("");
		showFeedbackToast("폴더를 삭제했습니다.");
		await reloadBootstrap();
		await loadSnippetList({ folderNo: selectedFolderNo === folder.folderNo ? null : selectedFolderNo });
		setIsActionPending(false);
	};

	// 언어 삭제를 처리합니다.
	const handleDeleteLanguage = async (language: SnippetLanguage) => {
		if (!window.confirm(`"${language.languageNm}" 언어를 삭제하시겠습니까? 사용 중인 스니펫이 있으면 삭제되지 않습니다.`)) {
			return;
		}

		setIsActionPending(true);
		const result = await requestSnippetClientApi<{ message: string }>(`/api/snippet/languages/${language.languageCd}`, {
			method: "DELETE",
		});

		if (!result.ok) {
			setMessage(result.message || "언어를 삭제하지 못했습니다.");
			setIsActionPending(false);
			return;
		}

		const nextLanguageCd = selectedLanguageCd === language.languageCd ? "" : selectedLanguageCd;
		if (selectedLanguageCd === language.languageCd) {
			setSelectedLanguageCd("");
		}

		setMessage("");
		showFeedbackToast("언어를 삭제했습니다.");
		await reloadBootstrap();
		await loadSnippetList({ languageCd: nextLanguageCd });
		setIsActionPending(false);
	};

	// 태그 삭제를 처리합니다.
	const handleDeleteTag = async (tag: SnippetTag) => {
		if (!window.confirm(`"${tag.tagNm}" 태그를 삭제하시겠습니까? 연결된 태그 매핑만 제거됩니다.`)) {
			return;
		}

		setIsActionPending(true);
		const result = await requestSnippetClientApi<{ message: string }>(`/api/snippet/tags/${tag.tagNo}`, {
			method: "DELETE",
		});

		if (!result.ok) {
			setMessage(result.message || "태그를 삭제하지 못했습니다.");
			setIsActionPending(false);
			return;
		}

		if (selectedTagNo === tag.tagNo) {
			setSelectedTagNo(null);
		}

		setMessage("");
		showFeedbackToast("태그를 삭제했습니다.");
		await reloadBootstrap();
		await loadSnippetList({ tagNo: selectedTagNo === tag.tagNo ? null : selectedTagNo });
		setIsActionPending(false);
	};

	// 스니펫 로그아웃을 처리합니다.
	const handleLogout = async () => {
		setIsActionPending(true);
		await logoutSnippet();
		await router.replace("/snippet/login");
	};

	const selectedFolderName =
		detail?.folderNo != null ? bootstrap?.folderList.find((folder) => folder.folderNo === detail.folderNo)?.folderNm ?? null : null;
	const selectedLanguageName =
		detail != null ? bootstrap?.languageList.find((language) => language.languageCd === detail.languageCd)?.languageNm ?? detail.languageCd.toUpperCase() : null;

	return (
		<>
			<Head>
				<title>Snippet Workspace</title>
				<meta name="description" content="react-resume 전용 스니펫 저장소 작업 화면" />
			</Head>

			<div className={styles.pageShell}>
				{message.trim() !== "" ? <p className={styles.messageBar}>{message}</p> : null}
				<div className={`${styles.feedbackToast} ${isFeedbackToastVisible ? styles.feedbackToastVisible : ""}`} aria-live="polite">
					{feedbackToastMessage}
				</div>
				{isInitializing ? <p className={styles.loadingText}>작업 화면을 준비하고 있습니다.</p> : null}

				{!isInitializing && bootstrap ? (
					<div className={styles.workspaceShell}>
						<aside className={styles.sidebar}>
							<section className={styles.searchCard}>
								<form className={styles.searchForm} onSubmit={handleSearchSubmit}>
									<input
										type="search"
										value={searchInput}
										onChange={(event) => setSearchInput(event.target.value)}
										placeholder="제목, 요약, 메모를 검색하세요"
										className={styles.searchInput}
									/>
									<button type="submit" className={styles.searchButton}>
										검색
									</button>

									<div className={styles.searchOptionRow}>
										<label className={styles.checkboxLabel}>
											<input
												type="checkbox"
												checked={includeBodyYn === "Y"}
												onChange={(event) => void handleIncludeBodyChange(event.target.checked)}
											/>
											본문 포함 검색
										</label>
									</div>
								</form>

								<div className={styles.quickActionBlock} ref={recentPanelRef}>
									<div className={styles.quickFilterRail}>
										{QUICK_FILTER_OPTION_LIST.map((quickFilterOption) => (
											<button
												key={quickFilterOption.value}
												type="button"
												className={`${styles.quickFilterButton} ${
													selectedQuickFilter === quickFilterOption.value ? styles.quickFilterButtonActive : ""
												}`}
												onClick={() => void handleQuickFilterChange(quickFilterOption.value)}
											>
												{quickFilterOption.label}
											</button>
										))}

										<button
											type="button"
											className={`${styles.historyToggleButton} ${
												openRecentPanel === "viewed" ? styles.historyToggleButtonActive : ""
											}`}
											onClick={() => handleRecentPanelToggle("viewed")}
										>
											최근 본
										</button>

										<button
											type="button"
											className={`${styles.historyToggleButton} ${
												openRecentPanel === "copied" ? styles.historyToggleButtonActive : ""
											}`}
											onClick={() => handleRecentPanelToggle("copied")}
										>
											최근 복사
										</button>
									</div>

									{openRecentPanel ? (
										<div className={styles.recentDropdown}>
											<p className={styles.recentDropdownTitle}>
												{openRecentPanel === "viewed" ? "최근 본 스니펫" : "최근 복사한 스니펫"}
											</p>

											<div className={styles.recentDropdownList}>
												{(openRecentPanel === "viewed" ? bootstrap.recentViewedList : bootstrap.recentCopiedList).length > 0 ? (
													(openRecentPanel === "viewed" ? bootstrap.recentViewedList : bootstrap.recentCopiedList).map((snippet) => (
														<button
															key={`${openRecentPanel}-${snippet.snippetNo}`}
															type="button"
															className={styles.recentDropdownItem}
															onClick={(event) => handleRecentSnippetOpen(snippet.snippetNo, event)}
														>
															<span className={styles.recentDropdownItemTitle}>{snippet.title}</span>
															<span className={styles.recentDropdownItemMeta}>{snippet.languageNm}</span>
														</button>
													))
												) : (
													<p className={styles.recentEmptyText}>아직 기록이 없습니다.</p>
												)}
											</div>
										</div>
									) : null}
								</div>
							</section>

							<section className={styles.listCard}>
								<div className={styles.listCardHeader}>
									<div className={styles.listHeaderActions}>
										<p className={styles.listCount}>
											총 {listResponse?.totalCount ?? 0}건 {isListLoading ? "· 불러오는 중" : ""}
										</p>
										<select
											value={selectedSortBy}
											onChange={(event) => void handleSortChange(event.target.value as SnippetSortBy)}
											className={styles.listSortSelect}
											aria-label="정렬 순서"
										>
											{SORT_OPTION_LIST.map((sortOption) => (
												<option key={sortOption.value} value={sortOption.value}>
													{sortOption.label}
												</option>
											))}
										</select>
									</div>
								</div>

								<div className={styles.listScroller}>
									{listResponse?.list.length ? (
										<div className={styles.snippetCardList}>
											{listResponse.list.map((snippet) => (
												<div
													key={snippet.snippetNo}
													className={`${styles.snippetCardItem} ${selectedSnippetNo === snippet.snippetNo ? styles.snippetCardItemActive : ""}`}
													onClick={() => setSelectedSnippetNo(snippet.snippetNo)}
													onKeyDown={(event) => {
														if (event.key === "Enter" || event.key === " ") {
															event.preventDefault();
															setSelectedSnippetNo(snippet.snippetNo);
														}
													}}
													tabIndex={0}
													role="button"
												>
													<div className={styles.snippetCardTitleRow}>
														<button
															type="button"
															className={styles.favoriteToggleButton}
															onClick={(event) => {
																event.stopPropagation();
																void handleFavoriteToggle(snippet);
															}}
															disabled={isActionPending}
															aria-label={snippet.favoriteYn === "Y" ? "즐겨찾기 해제" : "즐겨찾기 추가"}
														>
															{snippet.favoriteYn === "Y" ? "★" : "☆"}
														</button>
														<span className={styles.snippetCardTitle}>{snippet.title}</span>
													</div>
													<div className={styles.snippetCardMetaRow}>
														<span className={styles.languageBadge}>{snippet.languageNm}</span>
														{snippet.tagNameText ? <span className={styles.snippetCardTagText}>{snippet.tagNameText}</span> : null}
													</div>
												</div>
											))}
										</div>
									) : (
										<div className={styles.emptyState}>
											<p>조건에 맞는 스니펫이 없습니다.</p>
											<Link href="/snippet/edit/new" className={styles.emptyLink}>
												첫 스니펫 작성하기
											</Link>
										</div>
									)}
								</div>
							</section>

							<button type="button" className={styles.logoutButton} onClick={handleLogout} disabled={isActionPending}>
								로그아웃
							</button>
						</aside>

						<section className={styles.mainColumn}>
							<div className={styles.topRailStack}>
								<section className={styles.filterRail}>
									<div className={styles.filterRailHeader}>
										<span className={styles.filterRailLabel}>폴더</span>
										<button type="button" className={styles.railHeaderAddButton} onClick={handleCreateFolder} disabled={isActionPending} aria-label="폴더 추가">
											+
										</button>
									</div>
									<div className={styles.filterRailContent}>
										<button
											type="button"
											className={`${styles.railChipButton} ${selectedFolderNo === null ? styles.railChipButtonActive : ""}`}
											onClick={() => void handleFolderSelect(null)}
										>
											전체
										</button>

										{bootstrap.folderList.map((folder) => (
											<div
												key={folder.folderNo}
												className={`${styles.railChipItem} ${selectedFolderNo === folder.folderNo ? styles.railChipItemActive : ""}`}
											>
												<button type="button" className={styles.railChipItemButton} onClick={() => void handleFolderSelect(folder.folderNo)}>
													{folder.folderNm}
												</button>
												<button
													type="button"
													className={styles.railDeleteButton}
													onClick={() => void handleDeleteFolder(folder)}
													disabled={isActionPending}
													aria-label={`${folder.folderNm} 삭제`}
												>
													×
												</button>
											</div>
										))}
									</div>
									<div className={styles.filterRailTopActions}>
										<Link href="/snippet/edit/new" className={styles.primaryAction}>
											새 스니펫
										</Link>
									</div>
								</section>

								<section className={styles.filterRail}>
									<div className={styles.filterRailHeader}>
										<span className={styles.filterRailLabel}>언어</span>
										<button type="button" className={styles.railHeaderAddButton} onClick={handleCreateLanguage} disabled={isActionPending} aria-label="언어 추가">
											+
										</button>
									</div>
									<div className={styles.filterRailContent}>
										<button
											type="button"
											className={`${styles.railChipButton} ${selectedLanguageCd === "" ? styles.railChipButtonActive : ""}`}
											onClick={() => void handleLanguageChange("")}
										>
											전체
										</button>

										{bootstrap.languageList.map((language) => (
											<div
												key={language.languageCd}
												className={`${styles.railChipItem} ${selectedLanguageCd === language.languageCd ? styles.railChipItemActive : ""}`}
											>
												<button type="button" className={styles.railChipItemButton} onClick={() => void handleLanguageChange(language.languageCd)}>
													{language.languageNm}
												</button>
												<button
													type="button"
													className={styles.railDeleteButton}
													onClick={() => void handleDeleteLanguage(language)}
													disabled={isActionPending}
													aria-label={`${language.languageNm} 삭제`}
												>
													×
												</button>
											</div>
										))}
									</div>
								</section>

								<section className={styles.filterRail}>
									<div className={styles.filterRailHeader}>
										<span className={styles.filterRailLabel}>태그</span>
										<button type="button" className={styles.railHeaderAddButton} onClick={handleCreateTag} disabled={isActionPending} aria-label="태그 추가">
											+
										</button>
									</div>
									<div className={styles.filterRailContent}>
										<button
											type="button"
											className={`${styles.railChipButton} ${selectedTagNo === null ? styles.railChipButtonActive : ""}`}
											onClick={() => void handleTagSelect(null)}
										>
											전체
										</button>

										{bootstrap.tagList.map((tag) => (
											<div key={tag.tagNo} className={`${styles.railChipItem} ${selectedTagNo === tag.tagNo ? styles.railChipItemActive : ""}`}>
												<button type="button" className={styles.railChipItemButton} onClick={() => void handleTagSelect(tag.tagNo)}>
													#{tag.tagNm}
												</button>
												<button
													type="button"
													className={styles.railDeleteButton}
													onClick={() => void handleDeleteTag(tag)}
													disabled={isActionPending}
													aria-label={`${tag.tagNm} 삭제`}
												>
													×
												</button>
											</div>
										))}
									</div>
								</section>
							</div>

							<section className={styles.detailPanel}>
								{detail ? (
									<div className={styles.detailContent}>
										<div className={styles.detailTopBar}>
											<div className={styles.detailHeaderRow}>
												<div className={styles.detailHeadingGroup}>
													<div className={styles.detailMetaRow}>
														<span className={styles.languageBadge}>{selectedLanguageName}</span>
														{detail.tagNoList.map((tagNo) => {
															const matchedTag = bootstrap.tagList.find((tag) => tag.tagNo === tagNo);
															return matchedTag ? (
																<span key={tagNo} className={styles.detailTagChip}>
																	#{matchedTag.tagNm}
																</span>
															) : null;
														})}
														{selectedFolderName ? <span className={styles.detailMetaPill}>폴더 {selectedFolderName}</span> : null}
														{detail.duplicateYn === "Y" ? <span className={styles.duplicateBadge}>중복 후보</span> : null}
													</div>
													<div className={styles.detailTitleRow}>
														<button
															type="button"
															className={styles.detailFavoriteStarButton}
															onClick={() => void handleFavoriteToggle(detail)}
															disabled={isActionPending}
															aria-label={detail.favoriteYn === "Y" ? "즐겨찾기 해제" : "즐겨찾기 추가"}
														>
															{detail.favoriteYn === "Y" ? "★" : "☆"}
														</button>
														<h2 className={styles.detailHeading}>{detail.title}</h2>
													</div>
												</div>

												<div className={styles.detailActionRow}>
													<Link href={`/snippet/edit/${detail.snippetNo}`} className={styles.detailActionLink}>
														수정
													</Link>
													<button
														type="button"
														className={styles.detailDangerButton}
														onClick={() => void handleDeleteSnippet(detail.snippetNo)}
														disabled={isActionPending}
													>
														삭제
													</button>
												</div>
											</div>
										</div>

										<section className={styles.summaryBlock}>
											<h3 className={styles.summaryTitle}>요약</h3>
											<p className={styles.detailSummary}>{resolveCompactText(detail.summary, "요약이 없습니다.")}</p>
										</section>

										<div
											className={`${styles.codePanel} ${isCodeHovered ? styles.codePanelHover : ""}`}
											onMouseEnter={() => setIsCodeHovered(true)}
											onMouseLeave={() => setIsCodeHovered(false)}
											tabIndex={0}
										>
											<button
												type="button"
												className={styles.copyCodeButton}
												onClick={() => void handleCopySnippet(detail)}
												aria-label="코드 복사"
											>
												<CopyIcon />
											</button>
											<pre className={styles.codeBlock}>
												<code>{detail.snippetBody}</code>
											</pre>
										</div>

										{detail.memo && detail.memo.trim() !== "" ? (
											<div className={styles.memoBlock}>
												<h3 className={styles.memoTitle}>메모</h3>
												<p className={styles.memoText}>{detail.memo}</p>
											</div>
										) : null}
									</div>
								) : (
									<div className={styles.detailEmptyState}>
										<p className={styles.detailEyebrow}>상세 영역</p>
										<h2 className={styles.detailHeading}>목록에서 스니펫을 선택해 주세요.</h2>
										<p className={styles.detailSummary}>좌측 목록이나 최근 사용 패널에서 스니펫을 선택하면 이 영역에 상세 내용이 표시됩니다.</p>
									</div>
								)}
							</section>
						</section>
					</div>
				) : null}
			</div>
		</>
	);
}
