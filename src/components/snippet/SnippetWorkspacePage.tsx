import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState, type FormEvent } from "react";
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
	type SnippetListResponse,
	type SnippetSummary,
	type SnippetTag,
} from "@/services/snippetApiService";
import styles from "./SnippetWorkspacePage.module.css";

type SnippetQuickFilter = "all" | "favorite" | "recent_viewed" | "recent_copied" | "duplicate";
type SnippetSortBy = "updated_desc" | "viewed_desc" | "copied_desc" | "copy_count_desc" | "title_asc";

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
	{ value: "recent_viewed", label: "최근 본" },
	{ value: "recent_copied", label: "최근 복사" },
	{ value: "duplicate", label: "중복 후보" },
];

const SORT_OPTION_LIST: Array<{ value: SnippetSortBy; label: string }> = [
	{ value: "updated_desc", label: "수정일순" },
	{ value: "viewed_desc", label: "최근 조회순" },
	{ value: "copied_desc", label: "최근 복사순" },
	{ value: "copy_count_desc", label: "복사 수순" },
	{ value: "title_asc", label: "제목순" },
];

// 날짜 문자열을 화면용으로 포맷합니다.
function formatDateTime(value: string | null): string {
	if (!value) {
		return "-";
	}
	const parsedDate = new Date(value);
	if (Number.isNaN(parsedDate.getTime())) {
		return value;
	}
	return parsedDate.toLocaleString("ko-KR", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	});
}

// 스니펫 메인 작업 화면을 렌더링합니다.
export default function SnippetWorkspacePage() {
	const router = useRouter();
	const [isInitializing, setIsInitializing] = useState(true);
	const [isListLoading, setIsListLoading] = useState(false);
	const [isDetailLoading, setIsDetailLoading] = useState(false);
	const [isActionPending, setIsActionPending] = useState(false);
	const [message, setMessage] = useState("");
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
	const [selectedSortBy, setSelectedSortBy] = useState<SnippetSortBy>("updated_desc");
	const [selectedQuickFilter, setSelectedQuickFilter] = useState<SnippetQuickFilter>("all");

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

	// 페이지 진입 시 세션 복구와 bootstrap/목록 초기 조회를 수행합니다.
	useEffect(() => {
		let isCancelled = false;

		// 로그인 세션을 복구하고 초기 데이터 조회를 수행합니다.
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

			setIsDetailLoading(true);
			const detailResult = await fetchSnippetDetail(selectedSnippetNo);
			if (isCancelled) {
				return;
			}

			if (!detailResult.ok || !detailResult.data) {
				setMessage(detailResult.message || "스니펫 상세를 불러오지 못했습니다.");
				setDetail(null);
				setIsDetailLoading(false);
				return;
			}

			setDetail(detailResult.data);

			const viewedResult = await markSnippetViewed(selectedSnippetNo);
			if (isCancelled) {
				return;
			}
			if (!viewedResult.ok) {
				setMessage(viewedResult.message || "조회 이력을 갱신하지 못했습니다.");
				setIsDetailLoading(false);
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
			setIsDetailLoading(false);
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
			setMessage(result.message || "스니펫 목록을 불러오지 못했습니다.");
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

	// bootstrap 데이터를 다시 읽어 화면 보조 목록을 갱신합니다.
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
		await loadSnippetList({ quickFilter: nextQuickFilter });
	};

	// 검색 폼을 제출합니다.
	const handleSearchSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const nextKeyword = searchInput.trim();
		setSearchKeyword(nextKeyword);
		await loadSnippetList({ q: nextKeyword });
	};

	// 스니펫 복사를 처리합니다.
	const handleCopySnippet = async (snippet: SnippetDetailResponse) => {
		try {
			await navigator.clipboard.writeText(snippet.snippetBody);

			const copiedResult = await markSnippetCopied(snippet.snippetNo);
			if (!copiedResult.ok) {
				setMessage(copiedResult.message || "복사 이력을 갱신하지 못했습니다.");
				return;
			}

			setMessage("스니펫을 클립보드에 복사했습니다.");
			await reloadBootstrap();
			await loadSnippetList();
			await reloadDetail(snippet.snippetNo);
			setSelectedSnippetNo(snippet.snippetNo);
		} catch {
			setMessage("클립보드 복사에 실패했습니다.");
		}
	};

	// 현재 선택된 스니펫의 즐겨찾기 여부를 토글합니다.
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

		setMessage("즐겨찾기 상태를 변경했습니다.");
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

		setMessage("스니펫을 삭제했습니다.");
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

		setMessage("폴더를 추가했습니다.");
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

		setMessage("태그를 추가했습니다.");
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
		setMessage("폴더를 삭제했습니다.");
		await reloadBootstrap();
		await loadSnippetList({ folderNo: selectedFolderNo === folder.folderNo ? null : selectedFolderNo });
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
		setMessage("태그를 삭제했습니다.");
		await reloadBootstrap();
		await loadSnippetList({ tagNo: selectedTagNo === tag.tagNo ? null : selectedTagNo });
		setIsActionPending(false);
	};

	// 최근 사용 목록에서 스니펫을 선택합니다.
	const handleRecentSnippetSelect = (snippetNo: number) => {
		setSelectedSnippetNo(snippetNo);
	};

	// 스니펫 로그아웃을 처리합니다.
	const handleLogout = async () => {
		setIsActionPending(true);
		await logoutSnippet();
		await router.replace("/snippet/login");
	};

	return (
		<>
			<Head>
				<title>Snippet Workspace</title>
				<meta name="description" content="react-resume 전용 스니펫 저장소 작업 화면" />
			</Head>

			<div className={styles.pageShell}>
				<header className={styles.header}>
					<div>
						<p className={styles.eyebrow}>snippet workspace</p>
						<h1 className={styles.title}>재사용할 코드와 메모를 빠르게 찾아 다시 쓰는 개인 저장소</h1>
						<p className={styles.description}>
							검색 범위를 넓히고 최근 사용 흐름을 남겨, 저장한 스니펫을 더 빨리 찾고 더 자주 다시 꺼내 쓸 수 있도록 확장했습니다.
						</p>
					</div>

					<div className={styles.headerActions}>
						<Link href="/snippet/edit/new" className={styles.primaryLink}>
							새 스니펫
						</Link>
						<button type="button" className={styles.secondaryButton} onClick={handleLogout} disabled={isActionPending}>
							로그아웃
						</button>
					</div>
				</header>

				{message.trim() !== "" ? <p className={styles.messageBar}>{message}</p> : null}
				{isInitializing ? <p className={styles.loadingText}>작업 화면을 준비하고 있습니다.</p> : null}

				{!isInitializing && bootstrap ? (
					<div className={styles.layout}>
						<aside className={styles.sidebar}>
							<section className={styles.sidebarCard}>
								<p className={styles.sectionEyebrow}>사용자</p>
								<h2 className={styles.sidebarTitle}>{bootstrap.currentUser.userNm}</h2>
								<p className={styles.sidebarMeta}>{bootstrap.currentUser.email}</p>
							</section>

							<section className={styles.sidebarCard}>
								<div className={styles.sidebarHeader}>
									<h2 className={styles.sidebarTitle}>폴더</h2>
									<button type="button" className={styles.textButton} onClick={handleCreateFolder} disabled={isActionPending}>
										추가
									</button>
								</div>
								<button
									type="button"
									className={`${styles.filterChip} ${selectedFolderNo === null ? styles.filterChipActive : ""}`}
									onClick={() => void handleFolderSelect(null)}
								>
									<span>전체 보기</span>
								</button>
								<div className={styles.filterList}>
									{bootstrap.folderList.map((folder) => (
										<div key={folder.folderNo} className={styles.filterRow}>
											<button
												type="button"
												className={`${styles.filterChip} ${selectedFolderNo === folder.folderNo ? styles.filterChipActive : ""}`}
												onClick={() => void handleFolderSelect(folder.folderNo)}
											>
												<span>{folder.folderNm}</span>
												<strong>{folder.snippetCount}</strong>
											</button>
											<button
												type="button"
												className={styles.iconButton}
												onClick={() => void handleDeleteFolder(folder)}
												disabled={isActionPending}
												aria-label={`${folder.folderNm} 삭제`}
											>
												×
											</button>
										</div>
									))}
								</div>
							</section>

							<section className={styles.sidebarCard}>
								<div className={styles.sidebarHeader}>
									<h2 className={styles.sidebarTitle}>태그</h2>
									<button type="button" className={styles.textButton} onClick={handleCreateTag} disabled={isActionPending}>
										추가
									</button>
								</div>
								<div className={styles.filterList}>
									{bootstrap.tagList.map((tag) => (
										<div key={tag.tagNo} className={styles.filterRow}>
											<button
												type="button"
												className={`${styles.filterChip} ${selectedTagNo === tag.tagNo ? styles.filterChipActive : ""}`}
												onClick={() => void handleTagSelect(tag.tagNo)}
											>
												<span>#{tag.tagNm}</span>
												<strong>{tag.snippetCount}</strong>
											</button>
											<button
												type="button"
												className={styles.iconButton}
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

							<section className={styles.sidebarCard}>
								<h2 className={styles.sidebarTitle}>최근 본 5개</h2>
								<div className={styles.recentList}>
									{bootstrap.recentViewedList.length > 0 ? (
										bootstrap.recentViewedList.map((snippet) => (
											<button
												key={`viewed-${snippet.snippetNo}`}
												type="button"
												className={styles.recentItemButton}
												onClick={() => handleRecentSnippetSelect(snippet.snippetNo)}
											>
												<span className={styles.recentItemTitle}>{snippet.title}</span>
												<span className={styles.recentItemMeta}>
													{snippet.languageNm} · {formatDateTime(snippet.lastViewedDt)}
												</span>
											</button>
										))
									) : (
										<p className={styles.sidebarMeta}>아직 최근 조회 이력이 없습니다.</p>
									)}
								</div>
							</section>

							<section className={styles.sidebarCard}>
								<h2 className={styles.sidebarTitle}>최근 복사 5개</h2>
								<div className={styles.recentList}>
									{bootstrap.recentCopiedList.length > 0 ? (
										bootstrap.recentCopiedList.map((snippet) => (
											<button
												key={`copied-${snippet.snippetNo}`}
												type="button"
												className={styles.recentItemButton}
												onClick={() => handleRecentSnippetSelect(snippet.snippetNo)}
											>
												<span className={styles.recentItemTitle}>{snippet.title}</span>
												<span className={styles.recentItemMeta}>
													{snippet.languageNm} · {formatDateTime(snippet.lastCopiedDt)}
												</span>
											</button>
										))
									) : (
										<p className={styles.sidebarMeta}>아직 최근 복사 이력이 없습니다.</p>
									)}
								</div>
							</section>
						</aside>

						<section className={styles.mainPanel}>
							<div className={styles.toolbar}>
								<div className={styles.toolbarTop}>
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
									</form>

									<div className={styles.filterControls}>
										<select
											value={selectedLanguageCd}
											onChange={(event) => void handleLanguageChange(event.target.value)}
											className={styles.selectBox}
										>
											<option value="">전체 언어</option>
											{bootstrap.languageList.map((language) => (
												<option key={language.languageCd} value={language.languageCd}>
													{language.languageNm}
												</option>
											))}
										</select>

										<select
											value={selectedSortBy}
											onChange={(event) => void handleSortChange(event.target.value as SnippetSortBy)}
											className={styles.selectBox}
										>
											{SORT_OPTION_LIST.map((sortOption) => (
												<option key={sortOption.value} value={sortOption.value}>
													{sortOption.label}
												</option>
											))}
										</select>

										<label className={styles.checkboxLabel}>
											<input
												type="checkbox"
												checked={includeBodyYn === "Y"}
												onChange={(event) => void handleIncludeBodyChange(event.target.checked)}
											/>
											본문 포함 검색
										</label>
									</div>
								</div>

								<div className={styles.quickFilterList}>
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
								</div>
							</div>

							<div className={styles.workspaceGrid}>
								<section className={styles.listPanel}>
									<div className={styles.panelHeader}>
										<h2 className={styles.panelTitle}>스니펫 목록</h2>
										<p className={styles.panelMeta}>
											총 {listResponse?.totalCount ?? 0}건 {isListLoading ? "· 새로고침 중" : ""}
										</p>
									</div>

									<div className={styles.snippetList}>
										{listResponse?.list.length ? (
											listResponse.list.map((snippet) => (
												<button
													key={snippet.snippetNo}
													type="button"
													className={`${styles.snippetCard} ${selectedSnippetNo === snippet.snippetNo ? styles.snippetCardActive : ""}`}
													onClick={() => setSelectedSnippetNo(snippet.snippetNo)}
												>
													<div className={styles.snippetCardHeader}>
														<span className={styles.languageBadge}>{snippet.languageNm}</span>
														<div className={styles.snippetStatusGroup}>
															{snippet.duplicateYn === "Y" ? <span className={styles.duplicateBadge}>중복 후보</span> : null}
															<span className={styles.favoriteMark}>{snippet.favoriteYn === "Y" ? "★" : "☆"}</span>
														</div>
													</div>
													<h3 className={styles.snippetTitle}>{snippet.title}</h3>
													<p className={styles.snippetSummary}>{snippet.summary || "요약 없음"}</p>
													<p className={styles.snippetMetaLine}>{snippet.folderNm || "무폴더"} · 수정 {formatDateTime(snippet.udtDt || snippet.regDt)}</p>
													<p className={styles.snippetStatsLine}>조회 {snippet.viewCnt} · 복사 {snippet.copyCnt}</p>
													<p className={styles.snippetMetaLine}>
														최근 조회 {formatDateTime(snippet.lastViewedDt)} · 최근 복사 {formatDateTime(snippet.lastCopiedDt)}
													</p>
													{snippet.tagNameText ? <p className={styles.snippetTagText}>{snippet.tagNameText}</p> : null}
												</button>
											))
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

								<section className={styles.detailPanel}>
									<div className={styles.panelHeader}>
										<h2 className={styles.panelTitle}>상세 미리보기</h2>
										<p className={styles.panelMeta}>{isDetailLoading ? "불러오는 중" : detail ? formatDateTime(detail.udtDt || detail.regDt) : "선택 대기"}</p>
									</div>

									{detail ? (
										<div className={styles.detailContent}>
											<div className={styles.detailTop}>
												<div>
													<p className={styles.detailLanguage}>{detail.languageCd}</p>
													<div className={styles.detailTitleRow}>
														<h3 className={styles.detailTitle}>{detail.title}</h3>
														{detail.duplicateYn === "Y" ? <span className={styles.duplicateBadge}>중복 후보</span> : null}
													</div>
													<p className={styles.detailSummary}>{detail.summary || "요약이 없습니다."}</p>
												</div>

												<div className={styles.detailActions}>
													<button
														type="button"
														className={styles.secondaryButton}
														onClick={() => void handleFavoriteToggle(detail)}
														disabled={isActionPending}
													>
														{detail.favoriteYn === "Y" ? "즐겨찾기 해제" : "즐겨찾기"}
													</button>
													<button
														type="button"
														className={styles.secondaryButton}
														onClick={() => void handleCopySnippet(detail)}
														disabled={isActionPending}
													>
														복사
													</button>
													<Link href={`/snippet/edit/${detail.snippetNo}`} className={styles.secondaryLink}>
														수정
													</Link>
													<button
														type="button"
														className={styles.dangerButton}
														onClick={() => void handleDeleteSnippet(detail.snippetNo)}
														disabled={isActionPending}
													>
														삭제
													</button>
												</div>
											</div>

											<div className={styles.detailInfoGrid}>
												<div className={styles.detailInfoCard}>
													<span className={styles.detailInfoLabel}>조회 수</span>
													<strong className={styles.detailInfoValue}>{detail.viewCnt}</strong>
												</div>
												<div className={styles.detailInfoCard}>
													<span className={styles.detailInfoLabel}>복사 수</span>
													<strong className={styles.detailInfoValue}>{detail.copyCnt}</strong>
												</div>
												<div className={styles.detailInfoCard}>
													<span className={styles.detailInfoLabel}>마지막 조회</span>
													<strong className={styles.detailInfoValue}>{formatDateTime(detail.lastViewedDt)}</strong>
												</div>
												<div className={styles.detailInfoCard}>
													<span className={styles.detailInfoLabel}>마지막 복사</span>
													<strong className={styles.detailInfoValue}>{formatDateTime(detail.lastCopiedDt)}</strong>
												</div>
											</div>

											{detail.tagNoList.length > 0 ? (
												<div className={styles.detailTagList}>
													{detail.tagNoList.map((tagNo) => {
														const matchedTag = bootstrap.tagList.find((tag) => tag.tagNo === tagNo);
														return matchedTag ? (
															<span key={tagNo} className={styles.detailTagChip}>
																#{matchedTag.tagNm}
															</span>
														) : null;
													})}
												</div>
											) : null}

											<pre className={styles.codeBlock}>
												<code>{detail.snippetBody}</code>
											</pre>

											<div className={styles.memoBlock}>
												<h4 className={styles.memoTitle}>메모</h4>
												<p className={styles.memoText}>{detail.memo || "추가 메모가 없습니다."}</p>
											</div>
										</div>
									) : (
										<div className={styles.emptyState}>
											<p>목록에서 스니펫을 선택하면 상세 미리보기가 표시됩니다.</p>
										</div>
									)}
								</section>
							</div>
						</section>
					</div>
				) : null}
			</div>
		</>
	);
}
