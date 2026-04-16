import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import FeedbackLayer from "@/components/common/FeedbackLayer";
import useFeedbackLayer from "@/components/common/useFeedbackLayer";
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
	type SnippetSaveResponse,
	type SnippetSummary,
	type SnippetTag,
} from "@/services/snippetApiService";
import SnippetEditorForm, { type SnippetEditorMode } from "./SnippetEditorForm";
import { filterTagSuggestionList, findMatchedTag, normalizeTagSearchKey } from "./snippetTagSearchUtils";
import styles from "./SnippetWorkspacePage.module.css";

type SnippetQuickFilter = "all" | "favorite" | "duplicate" | "recent_viewed" | "recent_copied";
type SnippetSortBy = "created_desc" | "updated_desc" | "viewed_desc" | "copied_desc" | "copy_count_desc" | "title_asc";

interface SnippetListReloadOptions {
	q?: string;
	folderNo?: number | null;
	tagNo?: number | null;
	languageCd?: string;
	includeBodyYn?: string;
	sortBy?: SnippetSortBy;
	quickFilter?: SnippetQuickFilter;
}

interface OverlayPosition {
	top: number;
	left: number;
	width: number;
}

interface SnippetBlockingLoadingState {
	// 초기 진입 로딩 여부입니다.
	isInitializing: boolean;
	// 공통 후속 액션 진행 여부입니다.
	isActionPending: boolean;
	// 공통 후속 액션 문구입니다.
	actionPendingMessage: string;
	// 상세 조회 진행 여부입니다.
	isDetailLoading: boolean;
	// 목록 조회 진행 여부입니다.
	isListLoading: boolean;
}

const QUICK_FILTER_OPTION_LIST: Array<{ value: SnippetQuickFilter; label: string }> = [
	{ value: "all", label: "전체" },
	{ value: "favorite", label: "즐겨찾기" },
	{ value: "duplicate", label: "중복 후보" },
	{ value: "recent_viewed", label: "최근 본" },
	{ value: "recent_copied", label: "최근 복사" },
];

const SORT_OPTION_LIST: Array<{ value: SnippetSortBy; label: string }> = [
	{ value: "created_desc", label: "등록일순" },
	{ value: "updated_desc", label: "수정일순" },
	{ value: "viewed_desc", label: "최근 조회순" },
	{ value: "copied_desc", label: "최근 복사순" },
	{ value: "copy_count_desc", label: "복사 수순" },
	{ value: "title_asc", label: "제목순" },
];

const SNIPPET_PORTAL_THEME_STYLE = {
	"--panel-bg-strong": "#111822",
	"--panel-border": "rgba(148, 163, 184, 0.16)",
	"--panel-border-strong": "rgba(148, 163, 184, 0.28)",
	"--ink": "#f3f7fb",
	"--muted": "rgba(226, 232, 240, 0.72)",
	"--accent-strong": "#fb923c",
	"--danger": "#fda4af",
} as CSSProperties;

// 스니펫 화면에서 가장 우선순위가 높은 중앙 로딩 문구를 계산합니다.
function resolveSnippetBlockingLoadingMessage({
	isInitializing,
	isActionPending,
	actionPendingMessage,
	isDetailLoading,
	isListLoading,
}: SnippetBlockingLoadingState): string {
	if (isInitializing) {
		return "작업 화면을 준비하고 있습니다.";
	}
	if (isActionPending) {
		return actionPendingMessage.trim() || "작업을 처리하고 있습니다.";
	}
	if (isDetailLoading) {
		return "스니펫 상세를 불러오고 있습니다.";
	}
	if (isListLoading) {
		return "스니펫 목록을 불러오고 있습니다.";
	}
	return "";
}

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
	const { successMessage, isSuccessVisible, errorMessage, showSuccess, showError, clearError } = useFeedbackLayer();
	const topFilterScrollerRef = useRef<HTMLDivElement | null>(null);
	const folderSelectRef = useRef<HTMLDivElement | null>(null);
	const languageSelectRef = useRef<HTMLDivElement | null>(null);
	const tagFilterRef = useRef<HTMLDivElement | null>(null);
	const folderTriggerRef = useRef<HTMLButtonElement | null>(null);
	const languageTriggerRef = useRef<HTMLButtonElement | null>(null);
	const tagSearchShellRef = useRef<HTMLDivElement | null>(null);
	const folderMenuRef = useRef<HTMLDivElement | null>(null);
	const languageMenuRef = useRef<HTMLDivElement | null>(null);
	const tagSuggestionPanelRef = useRef<HTMLDivElement | null>(null);
	const [isInitializing, setIsInitializing] = useState(true);
	const [isListLoading, setIsListLoading] = useState(false);
	const [isDetailLoading, setIsDetailLoading] = useState(false);
	const [isActionPending, setIsActionPending] = useState(false);
	const [actionPendingMessage, setActionPendingMessage] = useState("");
	const [isCodeHovered, setIsCodeHovered] = useState(false);
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
	const [isFolderSelectOpen, setIsFolderSelectOpen] = useState(false);
	const [isLanguageSelectOpen, setIsLanguageSelectOpen] = useState(false);
	const [tagSearchInput, setTagSearchInput] = useState("");
	const [isTagSuggestionOpen, setIsTagSuggestionOpen] = useState(false);
	const [folderMenuPosition, setFolderMenuPosition] = useState<OverlayPosition | null>(null);
	const [languageMenuPosition, setLanguageMenuPosition] = useState<OverlayPosition | null>(null);
	const [tagSuggestionPosition, setTagSuggestionPosition] = useState<OverlayPosition | null>(null);
	const [editorModalOpen, setEditorModalOpen] = useState(false);
	const [editorMode, setEditorMode] = useState<SnippetEditorMode>("create");
	const [editingSnippetNo, setEditingSnippetNo] = useState<number | null>(null);
	const [isEditorModalSaving, setIsEditorModalSaving] = useState(false);

	// 기존 message 호출을 중앙 오류 박스 제어로 변환합니다.
	const setMessage = (nextMessage: string) => {
		if (nextMessage.trim() === "") {
			clearError();
			return;
		}
		showError(nextMessage);
	};

	// 성공 안내를 공통 중앙 토스트로 표시합니다.
	const showFeedbackToast = (toastMessage: string) => {
		showSuccess(toastMessage);
	};

	// 공통 후속 액션을 중앙 로딩 레이어와 함께 실행합니다.
	const runActionWithBlockingLoading = async <T,>(loadingMessage: string, action: () => Promise<T>): Promise<T> => {
		setIsActionPending(true);
		setActionPendingMessage(loadingMessage);
		try {
			return await action();
		} finally {
			setIsActionPending(false);
			setActionPendingMessage("");
		}
	};

	const blockingLoadingMessage = resolveSnippetBlockingLoadingMessage({
		isInitializing,
		isActionPending,
		actionPendingMessage,
		isDetailLoading,
		isListLoading,
	});

	// 상단 필터 드롭다운과 추천 패널을 한 번에 닫습니다.
	const closeTopFilterOverlay = () => {
		setIsFolderSelectOpen(false);
		setIsLanguageSelectOpen(false);
		setIsTagSuggestionOpen(false);
		setFolderMenuPosition(null);
		setLanguageMenuPosition(null);
		setTagSuggestionPosition(null);
	};

	// 트리거 요소 기준으로 오버레이 메뉴 위치를 계산합니다.
	const resolveOverlayPosition = (anchorElement: HTMLElement | null, minimumWidth: number): OverlayPosition | null => {
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

	// 상단 필터 바깥 클릭과 ESC 입력으로 열린 패널을 닫습니다.
	useEffect(() => {
		const handleDocumentMouseDown = (event: MouseEvent) => {
			const targetNode = event.target as Node;
			if (folderSelectRef.current?.contains(targetNode)) {
				return;
			}
			if (languageSelectRef.current?.contains(targetNode)) {
				return;
			}
			if (tagFilterRef.current?.contains(targetNode)) {
				return;
			}
			if (folderMenuRef.current?.contains(targetNode)) {
				return;
			}
			if (languageMenuRef.current?.contains(targetNode)) {
				return;
			}
			if (tagSuggestionPanelRef.current?.contains(targetNode)) {
				return;
			}
			setIsFolderSelectOpen(false);
			setIsLanguageSelectOpen(false);
			setIsTagSuggestionOpen(false);
			setFolderMenuPosition(null);
			setLanguageMenuPosition(null);
			setTagSuggestionPosition(null);
		};

		const handleWindowKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setIsFolderSelectOpen(false);
				setIsLanguageSelectOpen(false);
				setIsTagSuggestionOpen(false);
			}
		};

		document.addEventListener("mousedown", handleDocumentMouseDown);
		window.addEventListener("keydown", handleWindowKeyDown);
		return () => {
			document.removeEventListener("mousedown", handleDocumentMouseDown);
			window.removeEventListener("keydown", handleWindowKeyDown);
		};
	}, []);

	// 열린 상단 오버레이의 위치를 스크롤과 리사이즈에 맞춰 갱신합니다.
	useEffect(() => {
		if (!isFolderSelectOpen && !isLanguageSelectOpen && !isTagSuggestionOpen) {
			return;
		}

		const updateOverlayPosition = () => {
			if (isFolderSelectOpen) {
				setFolderMenuPosition(resolveOverlayPosition(folderTriggerRef.current, 220));
			}
			if (isLanguageSelectOpen) {
				setLanguageMenuPosition(resolveOverlayPosition(languageTriggerRef.current, 220));
			}
			if (isTagSuggestionOpen && normalizeTagSearchKey(tagSearchInput) !== "") {
				setTagSuggestionPosition(resolveOverlayPosition(tagSearchShellRef.current, 260));
			}
		};

		updateOverlayPosition();
		const filterScroller = topFilterScrollerRef.current;
		window.addEventListener("resize", updateOverlayPosition);
		window.addEventListener("scroll", updateOverlayPosition, true);
		filterScroller?.addEventListener("scroll", updateOverlayPosition);
		return () => {
			window.removeEventListener("resize", updateOverlayPosition);
			window.removeEventListener("scroll", updateOverlayPosition, true);
			filterScroller?.removeEventListener("scroll", updateOverlayPosition);
		};
	}, [isFolderSelectOpen, isLanguageSelectOpen, isTagSuggestionOpen, tagSearchInput]);

	// 편집 모달이 열리면 body 스크롤을 잠그고 ESC 닫기를 처리합니다.
	useEffect(() => {
		if (!editorModalOpen) {
			return;
		}

		const previousOverflow = document.body.style.overflow;
		const handleWindowKeyDown = (event: KeyboardEvent) => {
			// 저장 중이 아닐 때만 ESC로 모달을 닫습니다.
			if (event.key === "Escape" && !isEditorModalSaving) {
				setEditorModalOpen(false);
				setEditingSnippetNo(null);
			}
		};

		document.body.style.overflow = "hidden";
		window.addEventListener("keydown", handleWindowKeyDown);
		return () => {
			document.body.style.overflow = previousOverflow;
			window.removeEventListener("keydown", handleWindowKeyDown);
		};
	}, [editorModalOpen, isEditorModalSaving]);

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
			await loadSnippetList();
			if (!isCancelled) {
				setIsInitializing(false);
			}
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
			try {
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

				const bootstrapReloaded = await reloadBootstrap();
				if (isCancelled || !bootstrapReloaded) {
					return;
				}

				const listReloaded = await loadSnippetList();
				if (isCancelled || !listReloaded) {
					return;
				}

				const refreshedDetailResult = await fetchSnippetDetail(selectedSnippetNo);
				if (isCancelled) {
					return;
				}

				if (!refreshedDetailResult.ok || !refreshedDetailResult.data) {
					setMessage(refreshedDetailResult.message || "스니펫 상세를 다시 불러오지 못했습니다.");
					return;
				}

				setDetail(refreshedDetailResult.data);
			} finally {
				if (!isCancelled) {
					setIsDetailLoading(false);
				}
			}
		};

		void loadDetail();
		return () => {
			isCancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedSnippetNo]);

	// 현재 필터 기준으로 스니펫 목록을 다시 조회합니다.
	const loadSnippetList = async (options: SnippetListReloadOptions = {}): Promise<boolean> => {
		const resolvedQ = typeof options.q === "string" ? options.q : searchKeyword;
		const resolvedFolderNo = Object.prototype.hasOwnProperty.call(options, "folderNo") ? options.folderNo ?? null : selectedFolderNo;
		const resolvedTagNo = Object.prototype.hasOwnProperty.call(options, "tagNo") ? options.tagNo ?? null : selectedTagNo;
		const resolvedLanguageCd = typeof options.languageCd === "string" ? options.languageCd : selectedLanguageCd;
		const resolvedIncludeBodyYn = typeof options.includeBodyYn === "string" ? options.includeBodyYn : includeBodyYn;
		const resolvedSortBy = typeof options.sortBy === "string" ? options.sortBy : selectedSortBy;
		const resolvedQuickFilter = typeof options.quickFilter === "string" ? options.quickFilter : selectedQuickFilter;

		setIsListLoading(true);
		try {
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
				return false;
			}

			applyListResponse(result.data);
			return true;
		} finally {
			setIsListLoading(false);
		}
	};

	// bootstrap 데이터를 다시 읽어 보조 목록을 갱신합니다.
	const reloadBootstrap = async (): Promise<boolean> => {
		const result = await fetchSnippetBootstrap();
		if (!result.ok || !result.data) {
			setMessage(result.message || "보조 데이터를 다시 불러오지 못했습니다.");
			return false;
		}
		setBootstrap(result.data);
		return true;
	};

	// 현재 선택된 스니펫 상세를 다시 읽어 상세 패널을 최신 상태로 맞춥니다.
	const reloadDetail = async (snippetNo: number): Promise<boolean> => {
		const result = await fetchSnippetDetail(snippetNo);
		if (!result.ok || !result.data) {
			setMessage(result.message || "스니펫 상세를 다시 불러오지 못했습니다.");
			return false;
		}
		setDetail(result.data);
		return true;
	};

	// 폴더 필터를 지정한 값으로 변경합니다.
	const handleFolderSelect = async (folderNo: number | null) => {
		closeTopFilterOverlay();
		setSelectedFolderNo(folderNo);
		await loadSnippetList({ folderNo });
	};

	// 태그 필터를 지정한 값으로 변경합니다.
	const handleTagSelect = async (tagNo: number | null) => {
		closeTopFilterOverlay();
		setSelectedTagNo(tagNo);
		setTagSearchInput("");
		await loadSnippetList({ tagNo });
	};

	// 언어 필터를 변경합니다.
	const handleLanguageChange = async (nextLanguageCd: string) => {
		closeTopFilterOverlay();
		setSelectedLanguageCd(nextLanguageCd);
		await loadSnippetList({ languageCd: nextLanguageCd });
	};

	// 폴더 셀렉트 레이어를 토글합니다.
	const handleFolderSelectToggle = () => {
		const nextOpenState = !isFolderSelectOpen;
		closeTopFilterOverlay();
		setIsFolderSelectOpen(nextOpenState);
	};

	// 언어 셀렉트 레이어를 토글합니다.
	const handleLanguageSelectToggle = () => {
		const nextOpenState = !isLanguageSelectOpen;
		closeTopFilterOverlay();
		setIsLanguageSelectOpen(nextOpenState);
	};

	// 상단 태그 검색 입력값을 갱신합니다.
	const handleTagSearchInputChange = (value: string) => {
		setTagSearchInput(value);
		setIsFolderSelectOpen(false);
		setIsLanguageSelectOpen(false);
		setFolderMenuPosition(null);
		setLanguageMenuPosition(null);
		setIsTagSuggestionOpen(normalizeTagSearchKey(value) !== "");
	};

	// 상단 태그 검색창 포커스 시 추천 패널을 엽니다.
	const handleTagSearchFocus = () => {
		setIsFolderSelectOpen(false);
		setIsLanguageSelectOpen(false);
		setFolderMenuPosition(null);
		setLanguageMenuPosition(null);
		setIsTagSuggestionOpen(normalizeTagSearchKey(tagSearchInput) !== "");
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

	// 신규 스니펫 등록 모달을 엽니다.
	const handleOpenCreateEditor = () => {
		setEditorMode("create");
		setEditingSnippetNo(null);
		setEditorModalOpen(true);
	};

	// 기존 스니펫 수정 모달을 엽니다.
	const handleOpenEditEditor = (snippetNo: number) => {
		setEditorMode("edit");
		setEditingSnippetNo(snippetNo);
		setEditorModalOpen(true);
	};

	// 저장 중이 아닐 때 편집 모달을 닫습니다.
	const handleCloseEditorModal = () => {
		if (isEditorModalSaving) {
			return;
		}
		setEditorModalOpen(false);
		setEditingSnippetNo(null);
	};

	// 모달 저장 성공 후 목록/상세/보조 데이터를 다시 동기화합니다.
	const handleEditorSaved = async (response: SnippetSaveResponse) => {
		setEditorModalOpen(false);
		setEditingSnippetNo(null);
		setIsEditorModalSaving(false);
		await runActionWithBlockingLoading("저장 결과를 반영하고 있습니다.", async () => {
			const bootstrapReloaded = await reloadBootstrap();
			if (!bootstrapReloaded) {
				return;
			}

			const listReloaded = await loadSnippetList();
			if (!listReloaded) {
				return;
			}

			setSelectedSnippetNo(response.snippetNo);
			const detailReloaded = await reloadDetail(response.snippetNo);
			if (!detailReloaded) {
				return;
			}

			showFeedbackToast(response.message);
		});
	};

	// 코드 복사를 처리하고 상세/목록을 최신 상태로 갱신합니다.
	const handleCopySnippet = async (snippet: SnippetDetailResponse) => {
		await runActionWithBlockingLoading("스니펫을 복사하고 있습니다.", async () => {
			try {
				await navigator.clipboard.writeText(snippet.snippetBody);

				const copiedResult = await markSnippetCopied(snippet.snippetNo);
				if (!copiedResult.ok) {
					setMessage(copiedResult.message || "복사 이력을 갱신하지 못했습니다.");
					return;
				}

				const bootstrapReloaded = await reloadBootstrap();
				if (!bootstrapReloaded) {
					return;
				}

				const listReloaded = await loadSnippetList();
				if (!listReloaded) {
					return;
				}

				const detailReloaded = await reloadDetail(snippet.snippetNo);
				if (!detailReloaded) {
					return;
				}

				setSelectedSnippetNo(snippet.snippetNo);
				showFeedbackToast("복사되었습니다.");
			} catch {
				setMessage("클립보드 복사에 실패했습니다.");
			}
		});
	};

	// 선택된 스니펫의 즐겨찾기 여부를 토글합니다.
	const handleFavoriteToggle = async (snippet: SnippetSummary | SnippetDetailResponse) => {
		await runActionWithBlockingLoading("즐겨찾기 상태를 변경하고 있습니다.", async () => {
			const nextFavoriteYn = snippet.favoriteYn === "Y" ? "N" : "Y";

			const result = await requestSnippetClientApi<{ message: string }>(`/api/snippet/snippets/${snippet.snippetNo}/favorite`, {
				method: "PATCH",
				body: {
					favoriteYn: nextFavoriteYn,
				},
			});

			if (!result.ok) {
				setMessage(result.message || "즐겨찾기 상태를 변경하지 못했습니다.");
				return;
			}

			const bootstrapReloaded = await reloadBootstrap();
			if (!bootstrapReloaded) {
				return;
			}

			const listReloaded = await loadSnippetList();
			if (!listReloaded) {
				return;
			}

			const detailReloaded = await reloadDetail(snippet.snippetNo);
			if (!detailReloaded) {
				return;
			}

			setSelectedSnippetNo(snippet.snippetNo);
			showFeedbackToast("즐겨찾기 상태를 변경했습니다.");
		});
	};

	// 스니펫 삭제를 처리합니다.
	const handleDeleteSnippet = async (snippetNo: number) => {
		if (!window.confirm("선택한 스니펫을 삭제하시겠습니까?")) {
			return;
		}

		await runActionWithBlockingLoading("스니펫을 삭제하고 있습니다.", async () => {
			const result = await requestSnippetClientApi<{ message: string }>(`/api/snippet/snippets/${snippetNo}`, {
				method: "DELETE",
			});

			if (!result.ok) {
				setMessage(result.message || "스니펫을 삭제하지 못했습니다.");
				return;
			}

			setDetail(null);
			const bootstrapReloaded = await reloadBootstrap();
			if (!bootstrapReloaded) {
				return;
			}

			const listReloaded = await loadSnippetList();
			if (!listReloaded) {
				return;
			}

			showFeedbackToast("스니펫을 삭제했습니다.");
		});
	};

	// 폴더를 추가합니다.
	const handleCreateFolder = async () => {
		closeTopFilterOverlay();
		const folderNm = window.prompt("새 폴더명을 입력해주세요.");
		if (!folderNm || folderNm.trim() === "") {
			return;
		}

		await runActionWithBlockingLoading("폴더를 추가하고 있습니다.", async () => {
			const result = await requestSnippetClientApi<SnippetFolder>("/api/snippet/folders", {
				method: "POST",
				body: {
					folderNm: folderNm.trim(),
					colorHex: "#D96C47",
				},
			});

			if (!result.ok) {
				setMessage(result.message || "폴더를 추가하지 못했습니다.");
				return;
			}

			const bootstrapReloaded = await reloadBootstrap();
			if (!bootstrapReloaded) {
				return;
			}

			showFeedbackToast("폴더를 추가했습니다.");
		});
	};

	// 언어를 추가합니다.
	const handleCreateLanguage = async () => {
		closeTopFilterOverlay();
		const languageNm = window.prompt("새 언어명을 입력해주세요.");
		if (!languageNm || languageNm.trim() === "") {
			return;
		}

		await runActionWithBlockingLoading("언어를 추가하고 있습니다.", async () => {
			const result = await requestSnippetClientApi<SnippetLanguage>("/api/snippet/languages", {
				method: "POST",
				body: {
					languageNm: languageNm.trim(),
				},
			});

			if (!result.ok) {
				setMessage(result.message || "언어를 추가하지 못했습니다.");
				return;
			}

			const bootstrapReloaded = await reloadBootstrap();
			if (!bootstrapReloaded) {
				return;
			}

			showFeedbackToast("언어를 추가했습니다.");
		});
	};

	// 태그를 추가합니다.
	const handleCreateTag = async () => {
		closeTopFilterOverlay();
		const tagNm = window.prompt("새 태그명을 입력해주세요.");
		if (!tagNm || tagNm.trim() === "") {
			return;
		}

		await runActionWithBlockingLoading("태그를 추가하고 있습니다.", async () => {
			const result = await requestSnippetClientApi<SnippetTag>("/api/snippet/tags", {
				method: "POST",
				body: {
					tagNm: tagNm.trim(),
					colorHex: "#3B7EA1",
				},
			});

			if (!result.ok) {
				setMessage(result.message || "태그를 추가하지 못했습니다.");
				return;
			}

			const bootstrapReloaded = await reloadBootstrap();
			if (!bootstrapReloaded) {
				return;
			}

			showFeedbackToast("태그를 추가했습니다.");
		});
	};

	// 폴더 삭제를 처리합니다.
	const handleDeleteFolder = async (folder: SnippetFolder) => {
		closeTopFilterOverlay();
		if (!window.confirm(`"${folder.folderNm}" 폴더를 삭제하시겠습니까? 연결된 스니펫은 무폴더 상태로 유지됩니다.`)) {
			return;
		}

		await runActionWithBlockingLoading("폴더를 삭제하고 있습니다.", async () => {
			const result = await requestSnippetClientApi<{ message: string }>(`/api/snippet/folders/${folder.folderNo}`, {
				method: "DELETE",
			});

			if (!result.ok) {
				setMessage(result.message || "폴더를 삭제하지 못했습니다.");
				return;
			}

			const nextFolderNo = selectedFolderNo === folder.folderNo ? null : selectedFolderNo;
			if (selectedFolderNo === folder.folderNo) {
				setSelectedFolderNo(null);
			}

			const bootstrapReloaded = await reloadBootstrap();
			if (!bootstrapReloaded) {
				return;
			}

			const listReloaded = await loadSnippetList({ folderNo: nextFolderNo });
			if (!listReloaded) {
				return;
			}

			showFeedbackToast("폴더를 삭제했습니다.");
		});
	};

	// 언어 삭제를 처리합니다.
	const handleDeleteLanguage = async (language: SnippetLanguage) => {
		closeTopFilterOverlay();
		if (!window.confirm(`"${language.languageNm}" 언어를 삭제하시겠습니까? 사용 중인 스니펫이 있으면 삭제되지 않습니다.`)) {
			return;
		}

		await runActionWithBlockingLoading("언어를 삭제하고 있습니다.", async () => {
			const result = await requestSnippetClientApi<{ message: string }>(`/api/snippet/languages/${language.languageCd}`, {
				method: "DELETE",
			});

			if (!result.ok) {
				setMessage(result.message || "언어를 삭제하지 못했습니다.");
				return;
			}

			const nextLanguageCd = selectedLanguageCd === language.languageCd ? "" : selectedLanguageCd;
			if (selectedLanguageCd === language.languageCd) {
				setSelectedLanguageCd("");
			}

			const bootstrapReloaded = await reloadBootstrap();
			if (!bootstrapReloaded) {
				return;
			}

			const listReloaded = await loadSnippetList({ languageCd: nextLanguageCd });
			if (!listReloaded) {
				return;
			}

			showFeedbackToast("언어를 삭제했습니다.");
		});
	};

	// 태그 추천 목록에서 선택한 태그를 필터에 적용합니다.
	const handleWorkspaceTagSuggestionSelect = async (tag: SnippetTag) => {
		if (selectedTagNo === tag.tagNo) {
			setTagSearchInput("");
			setIsTagSuggestionOpen(false);
			return;
		}
		await handleTagSelect(tag.tagNo);
	};

	// 상단 태그 검색창의 Enter와 Escape 동작을 처리합니다.
	const handleTagSearchKeyDown = async (event: ReactKeyboardEvent<HTMLInputElement>) => {
		if (event.nativeEvent.isComposing) {
			return;
		}

		if (event.key === "Escape") {
			setIsTagSuggestionOpen(false);
			return;
		}

		if (event.key !== "Enter") {
			return;
		}

		const matchedTag = findMatchedTag(bootstrap?.tagList ?? [], tagSearchInput);
		if (matchedTag === null) {
			return;
		}

		event.preventDefault();
		await handleWorkspaceTagSuggestionSelect(matchedTag);
	};

	// 스니펫 로그아웃을 처리합니다.
	const handleLogout = async () => {
		await runActionWithBlockingLoading("로그아웃하고 있습니다.", async () => {
			await logoutSnippet();
			await router.replace("/snippet/login");
		});
	};

	const folderList = bootstrap?.folderList ?? [];
	const languageList = bootstrap?.languageList ?? [];
	const tagList = bootstrap?.tagList ?? [];
	const selectedFolderFilter = folderList.find((folder) => folder.folderNo === selectedFolderNo) ?? null;
	const selectedLanguageFilter = languageList.find((language) => language.languageCd === selectedLanguageCd) ?? null;
	const selectedTagFilter = tagList.find((tag) => tag.tagNo === selectedTagNo) ?? null;
	const normalizedTagSearchKeyValue = normalizeTagSearchKey(tagSearchInput);
	const filteredTagSuggestionList = filterTagSuggestionList(
		tagList,
		tagSearchInput,
		selectedTagFilter ? [selectedTagFilter.tagNo] : [],
	).slice(0, 8);
	const detailFolderName =
		detail?.folderNo != null ? folderList.find((folder) => folder.folderNo === detail.folderNo)?.folderNm ?? null : null;
	const detailLanguageName =
		detail != null ? languageList.find((language) => language.languageCd === detail.languageCd)?.languageNm ?? detail.languageCd.toUpperCase() : null;
	const folderSelectMenuLayer =
		typeof document !== "undefined" && isFolderSelectOpen && folderMenuPosition
			? createPortal(
					<div
						ref={folderMenuRef}
						className={styles.inlineSelectMenu}
						style={{ ...SNIPPET_PORTAL_THEME_STYLE, top: folderMenuPosition.top, left: folderMenuPosition.left, width: folderMenuPosition.width }}
						role="listbox"
						aria-label="폴더 선택"
					>
						<button
							type="button"
							className={`${styles.inlineSelectOption} ${selectedFolderNo === null ? styles.inlineSelectOptionActive : ""}`}
							onClick={() => void handleFolderSelect(null)}
						>
							전체
						</button>
						{folderList.map((folder) => (
							<div
								key={folder.folderNo}
								className={`${styles.inlineSelectMenuRow} ${selectedFolderNo === folder.folderNo ? styles.inlineSelectMenuRowActive : ""}`}
							>
								<button type="button" className={styles.inlineSelectMenuButton} onClick={() => void handleFolderSelect(folder.folderNo)}>
									{folder.folderNm}
								</button>
								<button
									type="button"
									className={styles.inlineSelectMenuDeleteButton}
									onClick={() => void handleDeleteFolder(folder)}
									disabled={isActionPending}
									aria-label={`${folder.folderNm} 삭제`}
								>
									×
								</button>
							</div>
						))}
					</div>,
					document.body,
				)
			: null;
	const languageSelectMenuLayer =
		typeof document !== "undefined" && isLanguageSelectOpen && languageMenuPosition
			? createPortal(
					<div
						ref={languageMenuRef}
						className={styles.inlineSelectMenu}
						style={{ ...SNIPPET_PORTAL_THEME_STYLE, top: languageMenuPosition.top, left: languageMenuPosition.left, width: languageMenuPosition.width }}
						role="listbox"
						aria-label="언어 선택"
					>
						<button
							type="button"
							className={`${styles.inlineSelectOption} ${selectedLanguageCd === "" ? styles.inlineSelectOptionActive : ""}`}
							onClick={() => void handleLanguageChange("")}
						>
							전체
						</button>
						{languageList.map((language) => (
							<div
								key={language.languageCd}
								className={`${styles.inlineSelectMenuRow} ${
									selectedLanguageCd === language.languageCd ? styles.inlineSelectMenuRowActive : ""
								}`}
							>
								<button type="button" className={styles.inlineSelectMenuButton} onClick={() => void handleLanguageChange(language.languageCd)}>
									{language.languageNm}
								</button>
								<button
									type="button"
									className={styles.inlineSelectMenuDeleteButton}
									onClick={() => void handleDeleteLanguage(language)}
									disabled={isActionPending}
									aria-label={`${language.languageNm} 삭제`}
								>
									×
								</button>
							</div>
						))}
					</div>,
					document.body,
				)
			: null;
	const tagSuggestionLayer =
		typeof document !== "undefined" &&
		isTagSuggestionOpen &&
		normalizedTagSearchKeyValue !== "" &&
		tagSuggestionPosition
			? createPortal(
					<div
						ref={tagSuggestionPanelRef}
						className={styles.tagSuggestionPanel}
						style={{ ...SNIPPET_PORTAL_THEME_STYLE, top: tagSuggestionPosition.top, left: tagSuggestionPosition.left, width: tagSuggestionPosition.width }}
					>
						{filteredTagSuggestionList.length > 0 ? (
							filteredTagSuggestionList.map((tag) => (
								<button
									key={tag.tagNo}
									type="button"
									className={styles.tagSuggestionButton}
									onClick={() => void handleWorkspaceTagSuggestionSelect(tag)}
								>
									<span className={styles.tagSuggestionName}>#{tag.tagNm}</span>
									<span className={styles.tagSuggestionHint}>기존 태그 선택</span>
								</button>
							))
						) : (
							<p className={styles.tagSuggestionHelper}>일치하는 태그가 없습니다. 새 태그는 + 버튼으로 추가해 주세요.</p>
						)}
					</div>,
					document.body,
				)
			: null;

	return (
		<>
			<Head>
				<title>Snippet Workspace</title>
				<meta name="description" content="react-resume 전용 스니펫 저장소 작업 화면" />
			</Head>

			<div className={styles.pageShell}>
				<FeedbackLayer
					successMessage={successMessage}
					isSuccessVisible={isSuccessVisible}
					errorMessage={errorMessage}
					loadingVisible={blockingLoadingMessage !== ""}
					loadingMessage={blockingLoadingMessage}
					onErrorClose={clearError}
				/>
				{editorModalOpen && bootstrap ? (
					<div className={styles.editorModalOverlay} onClick={handleCloseEditorModal}>
						<div
							className={styles.editorModalDialog}
							role="dialog"
							aria-modal="true"
							aria-label={editorMode === "create" ? "새 스니펫 작성" : "스니펫 수정"}
							onClick={(event) => event.stopPropagation()}
						>
							<SnippetEditorForm
								mode={editorMode}
								snippetNo={editingSnippetNo}
								bootstrap={bootstrap}
								embedded
								onClose={handleCloseEditorModal}
								onSaved={handleEditorSaved}
								onSavingChange={setIsEditorModalSaving}
							/>
						</div>
					</div>
				) : null}

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
									<label className={styles.checkboxLabel}>
										<input
											type="checkbox"
											checked={includeBodyYn === "Y"}
											onChange={(event) => void handleIncludeBodyChange(event.target.checked)}
										/>
										본문 포함 검색
									</label>
								</form>

								<div className={styles.quickActionBlock}>
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
									</div>
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
														<span className={styles.snippetCardLanguageBadge}>{snippet.languageNm}</span>
														{snippet.tagNameText ? <span className={styles.snippetCardTagText}>{snippet.tagNameText}</span> : null}
													</div>
												</div>
											))}
										</div>
									) : (
											<div className={styles.emptyState}>
												<p>조건에 맞는 스니펫이 없습니다.</p>
												<button type="button" className={styles.emptyLink} onClick={handleOpenCreateEditor}>
													첫 스니펫 작성하기
												</button>
											</div>
										)}
									</div>
								</section>

							<button type="button" className={styles.logoutButton} onClick={handleLogout} disabled={isActionPending}>
								로그아웃
							</button>
						</aside>

						<section className={styles.mainColumn}>
							<div className={styles.topFilterBar}>
								<div className={styles.topFilterScroller} ref={topFilterScrollerRef}>
									<div className={styles.inlineFilterGroup} ref={folderSelectRef}>
										<div className={styles.inlineFilterLabelGroup}>
											<span className={styles.inlineFilterLabel}>폴더</span>
											<button
												type="button"
												className={styles.inlineToolButton}
												onClick={handleCreateFolder}
												disabled={isActionPending}
												aria-label="폴더 추가"
											>
												+
											</button>
										</div>
										<div className={styles.inlineSelectShell}>
											<button
												type="button"
												className={styles.inlineSelectTrigger}
												onClick={handleFolderSelectToggle}
												aria-haspopup="listbox"
												aria-expanded={isFolderSelectOpen}
												ref={folderTriggerRef}
											>
												<span className={styles.inlineSelectValue}>{selectedFolderFilter?.folderNm ?? "전체"}</span>
												<span className={styles.inlineSelectChevron}>{isFolderSelectOpen ? "▴" : "▾"}</span>
											</button>
										</div>
									</div>

									<div className={styles.inlineFilterGroup} ref={languageSelectRef}>
										<div className={styles.inlineFilterLabelGroup}>
											<span className={styles.inlineFilterLabel}>언어</span>
											<button
												type="button"
												className={styles.inlineToolButton}
												onClick={handleCreateLanguage}
												disabled={isActionPending}
												aria-label="언어 추가"
											>
												+
											</button>
										</div>
										<div className={styles.inlineSelectShell}>
											<button
												type="button"
												className={styles.inlineSelectTrigger}
												onClick={handleLanguageSelectToggle}
												aria-haspopup="listbox"
												aria-expanded={isLanguageSelectOpen}
												ref={languageTriggerRef}
											>
												<span className={styles.inlineSelectValue}>{selectedLanguageFilter?.languageNm ?? "전체"}</span>
												<span className={styles.inlineSelectChevron}>{isLanguageSelectOpen ? "▴" : "▾"}</span>
											</button>
										</div>
									</div>

									<div className={`${styles.inlineFilterGroup} ${styles.inlineFilterGroupWide}`} ref={tagFilterRef}>
										<div className={styles.inlineFilterLabelGroup}>
											<span className={styles.inlineFilterLabel}>태그</span>
											<button
												type="button"
												className={styles.inlineToolButton}
												onClick={handleCreateTag}
												disabled={isActionPending}
												aria-label="태그 추가"
											>
												+
											</button>
										</div>
										<button
											type="button"
											className={`${styles.inlineFlatButton} ${selectedTagNo === null ? styles.inlineFlatButtonActive : ""}`}
											onClick={() => void handleTagSelect(null)}
										>
											전체
										</button>
										{selectedTagFilter ? (
											<span className={styles.inlineSelectedChip}>
												<span className={styles.inlineSelectedChipLabel}>#{selectedTagFilter.tagNm}</span>
												<button
													type="button"
													className={styles.inlineSelectedChipRemove}
													onClick={() => void handleTagSelect(null)}
													aria-label="선택된 태그 해제"
												>
													×
												</button>
											</span>
										) : null}
										<div className={styles.tagSearchShell} ref={tagSearchShellRef}>
											<input
												type="text"
												value={tagSearchInput}
												onChange={(event) => handleTagSearchInputChange(event.target.value)}
												onFocus={handleTagSearchFocus}
												onKeyDown={(event) => void handleTagSearchKeyDown(event)}
												className={styles.tagSearchInput}
												placeholder="태그 검색"
											/>
										</div>
									</div>
								</div>

								<div className={styles.topFilterActionArea}>
									<button type="button" className={styles.primaryAction} onClick={handleOpenCreateEditor}>
										새 스니펫
									</button>
								</div>
							</div>

							<section className={styles.detailPanel}>
								{detail ? (
									<div className={styles.detailContent}>
										<div className={styles.detailTopBar}>
											<div className={styles.detailHeaderRow}>
												<div className={styles.detailHeadingGroup}>
													<div className={styles.detailMetaRow}>
														<span className={styles.languageBadge}>{detailLanguageName}</span>
														{detail.tagNoList.map((tagNo) => {
															const matchedTag = tagList.find((tag) => tag.tagNo === tagNo);
															return matchedTag ? (
																<span key={tagNo} className={styles.detailTagChip}>
																	#{matchedTag.tagNm}
																</span>
															) : null;
														})}
														{detailFolderName ? <span className={styles.detailMetaPill}>폴더 {detailFolderName}</span> : null}
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
													<button
														type="button"
														className={styles.detailActionButton}
														onClick={() => handleOpenEditEditor(detail.snippetNo)}
													>
														수정
													</button>
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
				{folderSelectMenuLayer}
				{languageSelectMenuLayer}
				{tagSuggestionLayer}
			</div>
		</>
	);
}
