import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import FeedbackLayer from "@/components/common/FeedbackLayer";
import useResizableSplitLayout from "@/components/common/useResizableSplitLayout";
import useFeedbackLayer from "@/components/common/useFeedbackLayer";
import AdminDateInput from "@/components/work/AdminDateInput";
import WorkReplyComposer from "@/components/work/WorkReplyComposer";
import WorkReadonlyHtml from "@/components/work/WorkReadonlyHtml";
import type {
	WorkBootstrapResponse,
	WorkCommonCode,
	WorkCompanyOption,
	WorkDetail,
	WorkDetailResponse,
	WorkDetailUpdateRequest,
	WorkFile,
	WorkImportFormState,
	WorkImportRequest,
	WorkListFilter,
	WorkListResponse,
	WorkListRow,
	WorkProjectOption,
	WorkReply,
	WorkReplyComposerSubmitPayload,
	WorkReplyFile,
} from "@/components/work/types";
import { isImageReplyFile, isImageSelectedFile, isImageWorkFile } from "@/components/work/workAttachmentUtils";
import {
	createWorkManual,
	createWorkReply,
	deleteWorkReply,
	downloadWorkFile,
	downloadWorkReplyFile,
	fetchWorkBootstrap,
	fetchWorkDetail,
	fetchWorkList,
	fetchWorkProjectList,
	fetchWorkSectionMore,
	importWork,
	logoutWork,
	refreshWorkSession,
	updateWorkDetail,
	updateWorkReply,
} from "@/services/workApiService";
import styles from "./WorkWorkspacePage.module.css";

const DEFAULT_SECTION_PAGE_SIZE = 10;
const WORK_COMPLETED_STATUS_CODE = "WORK_STAT_05";
const WORK_HOLD_STATUS_CODE = "WORK_STAT_90";

interface DetailEditFormState {
	// 현재 편집 중인 업무 번호입니다.
	workSeq: number;
	// 제목입니다.
	title: string;
	// 상태 코드입니다.
	workStatCd: string;
	// IT 담당자입니다.
	itManager: string;
	// 담당자입니다.
	coManager: string;
	// 업무 생성일시입니다.
	workCreateDt: string;
	// 업무 시작일시입니다.
	workStartDt: string;
	// 업무 종료일시입니다.
	workEndDt: string;
	// 공수 문자열입니다.
	workTime: string;
	// 본문입니다.
	content: string;
}

interface ManualCreateFormState {
	// 제목입니다.
	title: string;
	// 담당자입니다.
	coManager: string;
	// 우선순위 코드입니다.
	workPriorCd: string;
	// 본문입니다.
	content: string;
}

interface LoadWorkListOptions extends WorkListFilter {
	// 로드 후 우선 선택할 업무 번호입니다.
	preferredWorkSeq?: number | null;
}

// returnUrl을 업무관리 경로로만 제한합니다.
function resolveSafeReturnUrl(value: string | string[] | undefined): string {
	const rawValue = Array.isArray(value) ? value[0] ?? "" : value ?? "";
	const normalizedValue = rawValue.trim();
	if (!normalizedValue.startsWith("/work")) {
		return "/work";
	}
	return normalizedValue;
}

// 입력값을 공백 제거한 문자열로 정리합니다.
function trimText(value: string | null | undefined): string {
	return typeof value === "string" ? value.trim() : "";
}

// 상세 편집 폼의 빈 초기값을 생성합니다.
function createEmptyDetailEditForm(): DetailEditFormState {
	return {
		workSeq: 0,
		title: "",
		workStatCd: "",
		itManager: "",
		coManager: "",
		workCreateDt: "",
		workStartDt: "",
		workEndDt: "",
		workTime: "",
		content: "",
	};
}

// 수기 등록 폼의 빈 초기값을 생성합니다.
function createEmptyManualCreateForm(): ManualCreateFormState {
	return {
		title: "",
		coManager: "",
		workPriorCd: "",
		content: "",
	};
}

// SR 가져오기 폼의 빈 초기값을 생성합니다.
function createEmptyImportForm(): WorkImportFormState {
	return {
		workCompanySeq: "",
		workCompanyProjectSeq: "",
		workKey: "",
	};
}

// SR 가져오기 기본 회사 번호를 계산합니다.
function resolveDefaultImportCompanySeq(companyList: WorkCompanyOption[], selectedCompanySeq: number | null): string {
	if (selectedCompanySeq && companyList.some((companyItem) => companyItem.workCompanySeq === selectedCompanySeq)) {
		return String(selectedCompanySeq);
	}
	return companyList[0] ? String(companyList[0].workCompanySeq) : "";
}

// SR 가져오기 프로젝트 선택 안내 문구를 계산합니다.
function resolveImportProjectPlaceholderText(formState: WorkImportFormState, projectLoading: boolean): string {
	if (!formState.workCompanySeq) {
		return "회사를 먼저 선택하세요";
	}
	if (projectLoading) {
		return "프로젝트를 불러오는 중입니다.";
	}
	return "프로젝트를 선택하세요";
}

// 서버 날짜 문자열을 date 입력값으로 변환합니다.
function resolveDateInputValue(value: string | null | undefined): string {
	const normalizedValue = trimText(value);
	if (normalizedValue === "") {
		return "";
	}
	return normalizedValue.slice(0, 10);
}

// 숫자 문자열을 API 저장용 공수값으로 변환합니다.
function resolveNullableWorkTime(value: string): number | null {
	const normalizedValue = trimText(value);
	if (normalizedValue === "") {
		return null;
	}
	const parsedValue = Number(normalizedValue);
	return Number.isFinite(parsedValue) ? parsedValue : null;
}

// 상세 편집 폼을 API 요청 payload로 변환합니다.
function buildDetailUpdateRequest(form: DetailEditFormState): WorkDetailUpdateRequest {
	return {
		workSeq: form.workSeq,
		title: form.title,
		workStatCd: form.workStatCd,
		itManager: form.itManager,
		coManager: form.coManager,
		workCreateDt: form.workCreateDt,
		workStartDt: form.workStartDt,
		workEndDt: form.workEndDt,
		workTime: resolveNullableWorkTime(form.workTime),
		content: form.content,
		deleteWorkJobFileSeqList: [],
	};
}

// 상세 응답을 즉시 수정 폼 상태로 변환합니다.
function createDetailEditForm(detail: WorkDetail | null): DetailEditFormState {
	if (!detail) {
		return createEmptyDetailEditForm();
	}
	return {
		workSeq: detail.workSeq,
		title: detail.title || "",
		workStatCd: detail.workStatCd || "",
		itManager: detail.itManager || "",
		coManager: detail.coManager || "",
		workCreateDt: detail.workCreateDt || "",
		workStartDt: resolveDateInputValue(detail.workStartDt),
		workEndDt: resolveDateInputValue(detail.workEndDt),
		workTime: detail.workTime === null || typeof detail.workTime === "undefined" ? "" : String(detail.workTime),
		content: detail.content || "",
	};
}

// 상세 정보에서 목록 행 업데이트용 객체를 생성합니다.
function createWorkListRowFromDetail(detail: WorkDetail): WorkListRow {
	return {
		workSeq: detail.workSeq,
		workCompanySeq: detail.workCompanySeq,
		workCompanyProjectSeq: detail.workCompanyProjectSeq,
		workStatCd: detail.workStatCd,
		workKey: detail.workKey,
		title: detail.title,
		replyCount: detail.replyCount,
		workCreateDt: detail.workCreateDt,
		workStartDt: detail.workStartDt,
		workEndDt: detail.workEndDt,
		workTime: detail.workTime,
		workPriorCd: detail.workPriorCd,
		workPriorNm: detail.workPriorNm,
		itManager: detail.itManager,
		coManager: detail.coManager,
		regDt: detail.regDt,
		udtDt: detail.udtDt,
	};
}

// 업무 목록을 업무 생성일시 내림차순으로 정렬합니다.
function sortWorkListRowsByCreateDt(rowList: WorkListRow[]): WorkListRow[] {
	return [...rowList].sort((leftRow, rightRow) => {
		const createDateCompare = trimText(rightRow.workCreateDt).localeCompare(trimText(leftRow.workCreateDt));
		if (createDateCompare !== 0) {
			return createDateCompare;
		}
		return rightRow.workSeq - leftRow.workSeq;
	});
}

// 저장된 상세 값을 목록 응답에도 반영합니다.
function applyUpdatedWorkRowToListResponse(listResponse: WorkListResponse | null, updatedRow: WorkListRow): WorkListResponse | null {
	if (!listResponse) {
		return listResponse;
	}
	return {
		statusSectionList: listResponse.statusSectionList.map((sectionItem) => {
			const currentRow = sectionItem.list.find((rowItem) => rowItem.workSeq === updatedRow.workSeq);
			if (!currentRow && sectionItem.workStatCd !== updatedRow.workStatCd) {
				return sectionItem;
			}

			const filteredList = sectionItem.list.filter((rowItem) => rowItem.workSeq !== updatedRow.workSeq);
			if (sectionItem.workStatCd !== updatedRow.workStatCd) {
				const nextTotalCount = Math.max(0, sectionItem.totalCount - (currentRow ? 1 : 0));
				return {
					...sectionItem,
					list: filteredList,
					totalCount: nextTotalCount,
					hasMore: nextTotalCount > filteredList.length,
				};
			}

			const nextList = sortWorkListRowsByCreateDt([...filteredList, updatedRow]);
			const nextTotalCount = currentRow ? sectionItem.totalCount : sectionItem.totalCount + 1;
			const visibleListLimit = currentRow ? sectionItem.list.length : sectionItem.list.length + 1;
			const visibleList = nextList.slice(0, visibleListLimit);
			return {
				...sectionItem,
				list: visibleList,
				totalCount: nextTotalCount,
				hasMore: nextTotalCount > visibleList.length,
			};
		}),
	};
}

// 상태명 표시용 라벨을 계산합니다.
function resolveStatusName(workStatCd: string, workStatList: WorkCommonCode[]): string {
	return workStatList.find((codeItem) => codeItem.cd === workStatCd)?.cdNm || workStatCd || "상태 미지정";
}

// 사용 가능한 전체 상태 코드 목록을 계산합니다.
function resolveAllStatusCodeList(workStatList: WorkCommonCode[]): string[] {
	return workStatList
		.map((codeItem) => trimText(codeItem.cd))
		.filter((codeItem, index, codeList) => codeItem !== "" && codeList.indexOf(codeItem) === index);
}

// 화면 첫 진입 시 기본 선택할 상태 코드 목록을 계산합니다.
function resolveInitialSelectedStatusCodeList(workStatList: WorkCommonCode[]): string[] {
	const allStatusCodeList = resolveAllStatusCodeList(workStatList);
	const defaultStatusCodeList = allStatusCodeList.filter(
		(codeItem) => codeItem !== WORK_COMPLETED_STATUS_CODE && codeItem !== WORK_HOLD_STATUS_CODE,
	);
	return defaultStatusCodeList.length > 0 ? defaultStatusCodeList : allStatusCodeList;
}

// 상태 필터 버튼 문구를 계산합니다.
function resolveStatusFilterButtonLabel(selectedCodeList: string[], workStatList: WorkCommonCode[]): string {
	if (selectedCodeList.length < 1) {
		return "상태 선택 없음";
	}
	if (selectedCodeList.length === workStatList.length) {
		return "상태 전체";
	}
	if (selectedCodeList.length === 1) {
		return resolveStatusName(selectedCodeList[0], workStatList);
	}
	return `상태 ${selectedCodeList.length}개`;
}

// 업무 우선순위를 아이콘 표시용 키로 변환합니다.
function resolveWorkPriorityIconVariant(workPriorCd: string, workPriorNm: string): "high" | "normal" | "low" | "none" {
	const normalizedWorkPriorCode = trimText(workPriorCd).toUpperCase();
	if (normalizedWorkPriorCode === "WORK_PRIOR_01") {
		return "high";
	}
	if (normalizedWorkPriorCode === "WORK_PRIOR_02") {
		return "normal";
	}
	if (normalizedWorkPriorCode === "WORK_PRIOR_03") {
		return "low";
	}

	const normalizedWorkPriorName = trimText(workPriorNm);
	if (normalizedWorkPriorName.includes("높")) {
		return "high";
	}
	if (normalizedWorkPriorName.includes("낮")) {
		return "low";
	}
	if (normalizedWorkPriorName.includes("보통") || normalizedWorkPriorName.includes("중")) {
		return "normal";
	}
	return "none";
}

// 업무 우선순위 아이콘을 렌더링합니다.
function WorkPriorityIcon({
	workPriorCd,
	workPriorNm,
}: {
	// 업무 우선순위 코드입니다.
	workPriorCd: string;
	// 업무 우선순위명입니다.
	workPriorNm: string;
}) {
	const iconVariant = resolveWorkPriorityIconVariant(workPriorCd, workPriorNm);
	if (iconVariant === "none") {
		return null;
	}

	const iconLabel = trimText(workPriorNm) || "우선순위 미지정";
	return (
		<span
			className={`${styles.workPriorityIcon} ${
				iconVariant === "high"
					? styles.workPriorityIconHigh
					: iconVariant === "low"
						? styles.workPriorityIconLow
						: styles.workPriorityIconNormal
			}`}
			aria-label={iconLabel}
			title={iconLabel}
		>
			<svg viewBox="0 0 16 16" aria-hidden="true">
				{iconVariant === "high" ? <path d="M3 10.5 8 5.5l5 5" /> : null}
				{iconVariant === "normal" ? (
					<>
						<path d="M3.5 6h9" />
						<path d="M3.5 10h9" />
					</>
				) : null}
				{iconVariant === "low" ? <path d="m3 5.5 5 5 5-5" /> : null}
			</svg>
		</span>
	);
}

// Blob 다운로드를 브라우저에 위임합니다.
function triggerBrowserFileDownload(blob: Blob, fileName: string) {
	const blobUrl = window.URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = blobUrl;
	link.download = fileName;
	link.click();
	window.URL.revokeObjectURL(blobUrl);
}

interface WorkBlockingLoadingState {
	// 초기 진입 로딩 여부입니다.
	isInitializing: boolean;
	// 공통 액션 대기 여부입니다.
	isActionPending: boolean;
	// 공통 액션 대기 문구입니다.
	actionPendingMessage: string;
	// 상세 즉시 저장 여부입니다.
	isDetailSaving: boolean;
	// 댓글 저장/수정/삭제 여부입니다.
	isReplySaving: boolean;
	// 댓글 저장 관련 문구입니다.
	replySavingMessage: string;
	// 수기 등록 저장 여부입니다.
	isManualSaving: boolean;
	// SR 가져오기 저장 여부입니다.
	isImportSaving: boolean;
	// 프로젝트 목록 로딩 여부입니다.
	isImportProjectLoading: boolean;
	// 상태 섹션 추가 조회 여부입니다.
	hasSectionLoading: boolean;
	// 상세 조회 여부입니다.
	isDetailLoading: boolean;
	// 목록 조회 여부입니다.
	isListLoading: boolean;
	// 신규 댓글 이미지 업로드 여부입니다.
	isReplyImageUploading: boolean;
	// 수정 댓글 이미지 업로드 여부입니다.
	isEditingReplyImageUploading: boolean;
}

// 업무 화면에서 가장 우선순위가 높은 중앙 로딩 문구를 계산합니다.
function resolveWorkBlockingLoadingMessage({
	isInitializing,
	isActionPending,
	actionPendingMessage,
	isDetailSaving,
	isReplySaving,
	replySavingMessage,
	isManualSaving,
	isImportSaving,
	isImportProjectLoading,
	hasSectionLoading,
	isDetailLoading,
	isListLoading,
	isReplyImageUploading,
	isEditingReplyImageUploading,
}: WorkBlockingLoadingState): string {
	if (isInitializing) {
		return "업무 화면을 준비하고 있습니다.";
	}
	if (isManualSaving) {
		return "업무를 등록하고 있습니다.";
	}
	if (isImportSaving) {
		return "SR 업무를 가져오고 있습니다.";
	}
	if (isReplySaving) {
		return trimText(replySavingMessage) || "댓글을 처리하고 있습니다.";
	}
	if (isDetailSaving) {
		return "업무를 저장하고 있습니다.";
	}
	if (isActionPending) {
		return trimText(actionPendingMessage) || "작업을 처리하고 있습니다.";
	}
	if (isImportProjectLoading) {
		return "프로젝트 목록을 불러오고 있습니다.";
	}
	if (hasSectionLoading) {
		return "업무 목록을 더 불러오고 있습니다.";
	}
	if (isDetailLoading) {
		return "업무 상세를 불러오고 있습니다.";
	}
	if (isListLoading) {
		return "업무 목록을 불러오고 있습니다.";
	}
	if (isReplyImageUploading || isEditingReplyImageUploading) {
		return "이미지를 업로드하고 있습니다.";
	}
	return "";
}

// 공통 모달 셸을 렌더링합니다.
function WorkModalShell({
	title,
	onClose,
	children,
}: {
	// 모달 제목입니다.
	title: string;
	// 닫기 처리입니다.
	onClose: () => void;
	// 내부 콘텐츠입니다.
	children: ReactNode;
}) {
	return (
		<div className={styles.modalOverlay} onClick={onClose}>
			<div className={styles.modalDialog} onClick={(event) => event.stopPropagation()}>
				<div className={styles.modalHeader}>
					<h2 className={styles.modalTitle}>{title}</h2>
					<button type="button" className={styles.modalCloseIconButton} onClick={onClose} aria-label="닫기">
						×
					</button>
				</div>
				<div className={styles.modalBody}>{children}</div>
			</div>
		</div>
	);
}

// 업무관리 메인 작업 화면을 렌더링합니다.
export default function WorkWorkspacePage() {
	const router = useRouter();
	const statusFilterRef = useRef<HTMLDivElement | null>(null);
	const statusFilterAllInputRef = useRef<HTMLInputElement | null>(null);
	const workSplitLayout = useResizableSplitLayout({
		defaultPrimaryWidth: 340,
		minPrimaryWidth: 280,
		maxPrimaryWidth: 1600,
		maxPrimaryWidthRatio: 0.8,
		minSecondaryWidth: 220,
		collapseBreakpoint: 1024,
		primaryWidthCssVar: "--sidebar-width",
	});
	const { successMessage, isSuccessVisible, errorMessage, showSuccess, showError, clearError } = useFeedbackLayer();
	const [isInitializing, setIsInitializing] = useState(true);
	const [isListLoading, setIsListLoading] = useState(false);
	const [isDetailLoading, setIsDetailLoading] = useState(false);
	const [isDetailSaving, setIsDetailSaving] = useState(false);
	const [isReplySaving, setIsReplySaving] = useState(false);
	const [isActionPending, setIsActionPending] = useState(false);
	const [actionPendingMessage, setActionPendingMessage] = useState("");
	const [replySavingMessage, setReplySavingMessage] = useState("");
	const [bootstrap, setBootstrap] = useState<WorkBootstrapResponse | null>(null);
	const [projectList, setProjectList] = useState<WorkProjectOption[]>([]);
	const [listResponse, setListResponse] = useState<WorkListResponse | null>(null);
	const [detailResponse, setDetailResponse] = useState<WorkDetailResponse | null>(null);
	const [selectedWorkSeq, setSelectedWorkSeq] = useState<number | null>(null);
	const [selectedCompanySeq, setSelectedCompanySeq] = useState<number | null>(null);
	const [selectedProjectSeq, setSelectedProjectSeq] = useState<number | null>(null);
	const [searchInput, setSearchInput] = useState("");
	const [searchKeyword, setSearchKeyword] = useState("");
	const [includeBodyYn, setIncludeBodyYn] = useState("N");
	const [selectedStatusCodeList, setSelectedStatusCodeList] = useState<string[]>([]);
	const [statusFilterOpen, setStatusFilterOpen] = useState(false);
	const [detailEditForm, setDetailEditForm] = useState<DetailEditFormState>(createEmptyDetailEditForm);
	const [sectionLoadingMap, setSectionLoadingMap] = useState<Record<string, boolean>>({});
	const [previewImageUrl, setPreviewImageUrl] = useState("");
	const [isManualModalOpen, setIsManualModalOpen] = useState(false);
	const [isManualSaving, setIsManualSaving] = useState(false);
	const [manualForm, setManualForm] = useState<ManualCreateFormState>(createEmptyManualCreateForm);
	const [manualFiles, setManualFiles] = useState<File[]>([]);
	const [isImportModalOpen, setIsImportModalOpen] = useState(false);
	const [isImportSaving, setIsImportSaving] = useState(false);
	const [editingReplySeq, setEditingReplySeq] = useState<number | null>(null);
	const [isReplyComposerImageUploading, setIsReplyComposerImageUploading] = useState(false);
	const [isEditingReplyComposerImageUploading, setIsEditingReplyComposerImageUploading] = useState(false);

	// 기존 message 호출을 중앙 오류 박스 제어로 변환합니다.
	const setMessage = (nextMessage: string) => {
		if (trimText(nextMessage) === "") {
			clearError();
			return;
		}
		showError(nextMessage);
	};

	// 기존 성공 토스트 호출을 공통 성공 토스트로 변환합니다.
	const showFeedbackToast = (toastMessage: string) => {
		showSuccess(toastMessage);
	};

	const workStatList = useMemo(() => bootstrap?.workStatList ?? [], [bootstrap]);
	const allStatusCodeList = useMemo(() => resolveAllStatusCodeList(workStatList), [workStatList]);
	const workPriorList = useMemo(() => bootstrap?.workPriorList ?? [], [bootstrap]);
	const companyList = useMemo(() => bootstrap?.companyList ?? [], [bootstrap]);
	const currentUser = bootstrap?.currentUser ?? null;
	const selectedDetail = detailResponse?.detail ?? null;
	const isAllStatusCodeSelected = allStatusCodeList.length > 0 && selectedStatusCodeList.length === allStatusCodeList.length;
	const hasPartialStatusCodeSelection = selectedStatusCodeList.length > 0 && !isAllStatusCodeSelected;
	const statusFilterButtonLabel = resolveStatusFilterButtonLabel(selectedStatusCodeList, workStatList);
	const visibleStatusSectionList = useMemo(
		() => (listResponse?.statusSectionList ?? []).filter((sectionItem) => sectionItem.totalCount > 0),
		[listResponse],
	);
	const [importForm, setImportForm] = useState<WorkImportFormState>(createEmptyImportForm);
	const [importProjectList, setImportProjectList] = useState<WorkProjectOption[]>([]);
	const [isImportProjectLoading, setIsImportProjectLoading] = useState(false);
	const importProjectPlaceholderText = resolveImportProjectPlaceholderText(importForm, isImportProjectLoading);
	const hasSectionLoading = useMemo(
		() => Object.values(sectionLoadingMap).some((loadingFlag) => loadingFlag),
		[sectionLoadingMap],
	);
	const blockingLoadingMessage = resolveWorkBlockingLoadingMessage({
		isInitializing,
		isActionPending,
		actionPendingMessage,
		isDetailSaving,
		isReplySaving,
		replySavingMessage,
		isManualSaving,
		isImportSaving,
		isImportProjectLoading,
		hasSectionLoading,
		isDetailLoading,
		isListLoading,
		isReplyImageUploading: isReplyComposerImageUploading,
		isEditingReplyImageUploading: isEditingReplyComposerImageUploading,
	});

	// 댓글 수정 상태를 초기화합니다.
	const resetEditingReplyState = () => {
		setEditingReplySeq(null);
		setIsEditingReplyComposerImageUploading(false);
	};

	// 선택된 업무와 상세 패널을 함께 비웁니다.
	const clearSelectedWorkState = () => {
		setSelectedWorkSeq(null);
		applyDetailResponse(null);
	};

	// 상태 필터 결과가 없을 때 목록/상세를 빈 상태로 초기화합니다.
	const applyEmptyListState = () => {
		setListResponse({ statusSectionList: [] });
		setSectionLoadingMap({});
		clearSelectedWorkState();
	};

	// 상세 응답을 반영하고 목록 카드도 함께 동기화합니다.
	const applyDetailResponse = (nextDetailResponse: WorkDetailResponse | null) => {
		setDetailResponse(nextDetailResponse);
		setDetailEditForm(createDetailEditForm(nextDetailResponse?.detail ?? null));
		const nextDetail = nextDetailResponse?.detail ?? null;
		if (nextDetail) {
			setListResponse((prevState) => applyUpdatedWorkRowToListResponse(prevState, createWorkListRowFromDetail(nextDetail)));
		}
	};

	// 상태별 목록 응답을 반영하면서 선택 상태를 최대한 유지합니다.
	const applyListResponse = (nextListResponse: WorkListResponse, preferredWorkSeq?: number | null) => {
		setListResponse(nextListResponse);
		setSelectedWorkSeq((previousWorkSeq) => {
			const candidateWorkSeq = preferredWorkSeq ?? previousWorkSeq;
			if (
				candidateWorkSeq !== null &&
				nextListResponse.statusSectionList.some((sectionItem) => sectionItem.list.some((rowItem) => rowItem.workSeq === candidateWorkSeq))
			) {
				return candidateWorkSeq;
			}

			const firstRow = nextListResponse.statusSectionList.find((sectionItem) => sectionItem.list.length > 0)?.list[0] ?? null;
			return preferredWorkSeq ?? firstRow?.workSeq ?? null;
		});
	};

	// 현재 필터 상태를 기준으로 업무 목록을 다시 조회합니다.
	const loadWorkList = async (options: LoadWorkListOptions = {}) => {
		const targetCompanySeq = typeof options.workCompanySeq === "number" ? options.workCompanySeq : selectedCompanySeq;
		const targetProjectSeq = typeof options.workCompanyProjectSeq === "number" ? options.workCompanyProjectSeq : selectedProjectSeq;
		const targetKeyword = typeof options.title === "string" ? options.title : searchKeyword;
		const targetIncludeBodyYn = typeof options.includeBodyYn === "string" ? options.includeBodyYn : includeBodyYn;
		const targetStatusCodeList = options.workStatCdList ?? selectedStatusCodeList;
		if (typeof targetCompanySeq !== "number" || targetCompanySeq < 1 || typeof targetProjectSeq !== "number" || targetProjectSeq < 1) {
			applyEmptyListState();
			return;
		}
		if (targetStatusCodeList.length < 1) {
			applyEmptyListState();
			return;
		}

		setIsListLoading(true);
		try {
			// 회사/프로젝트/검색 조건 기준으로 상태별 첫 10건 목록을 조회합니다.
			const result = await fetchWorkList({
				workCompanySeq: targetCompanySeq,
				workCompanyProjectSeq: targetProjectSeq,
				title: targetKeyword,
				includeBodyYn: targetIncludeBodyYn,
				workStatCdList: targetStatusCodeList,
				sectionSize: DEFAULT_SECTION_PAGE_SIZE,
			});
			if (!result.ok || !result.data) {
				setMessage(result.message || "업무 목록을 불러오지 못했습니다.");
				return;
			}

			// 정상 조회가 끝나면 상태별 추가 조회 상태를 초기화합니다.
			setSectionLoadingMap({});
			applyListResponse(result.data, options.preferredWorkSeq);
		} finally {
			setIsListLoading(false);
		}
	};

	// 선택 업무 상세를 다시 조회합니다.
	const loadDetail = async (workSeq: number) => {
		setIsDetailLoading(true);
		try {
			// 업무 상세, 첨부, 댓글을 한 번에 조회해 우측 패널에 반영합니다.
			const result = await fetchWorkDetail(workSeq);
			if (!result.ok || !result.data) {
				setMessage(result.message || "업무 상세를 불러오지 못했습니다.");
				applyDetailResponse(null);
				return;
			}

			applyDetailResponse(result.data);
		} finally {
			setIsDetailLoading(false);
		}
	};

	// 즉시 수정 폼을 저장하고 최신 상세를 반영합니다.
	const persistDetailForm = async (nextForm: DetailEditFormState) => {
		if (nextForm.workSeq < 1) {
			return;
		}

		setDetailEditForm(nextForm);
		setIsDetailSaving(true);
		try {
			// 입력 중인 폼 값을 그대로 저장하고 최신 상세 응답으로 덮어씁니다.
			const result = await updateWorkDetail(buildDetailUpdateRequest(nextForm), []);
			if (!result.ok || !result.data) {
				setMessage(result.message || "업무 저장에 실패했습니다.");
				return;
			}

			applyDetailResponse(result.data);
			showFeedbackToast("업무를 저장했습니다.");
		} finally {
			setIsDetailSaving(false);
		}
	};

	// 화면 진입 시 세션과 bootstrap 데이터를 확인합니다.
	useEffect(() => {
		let isCancelled = false;

		// 세션을 복구한 뒤 첫 회사/프로젝트 기준으로 목록을 초기화합니다.
		const initializePage = async () => {
			const sessionResult = await refreshWorkSession();
			if (isCancelled) {
				return;
			}
			if (!sessionResult.ok || !sessionResult.data?.authenticated) {
				await router.replace(`/work/login?returnUrl=${encodeURIComponent(resolveSafeReturnUrl(router.asPath || "/work"))}`);
				return;
			}

			const bootstrapResult = await fetchWorkBootstrap();
			if (isCancelled) {
				return;
			}
			if (!bootstrapResult.ok || !bootstrapResult.data) {
				setMessage(bootstrapResult.message || "업무 화면 초기 데이터를 불러오지 못했습니다.");
				setIsInitializing(false);
				return;
			}

			const initialCompanySeq = bootstrapResult.data.companyList[0]?.workCompanySeq ?? null;
			const initialProjectSeq = bootstrapResult.data.projectList[0]?.workCompanyProjectSeq ?? null;
			const initialStatusCodeList = resolveInitialSelectedStatusCodeList(bootstrapResult.data.workStatList ?? []);
			setBootstrap(bootstrapResult.data);
			setProjectList(bootstrapResult.data.projectList ?? []);
			setSelectedCompanySeq(initialCompanySeq);
			setSelectedProjectSeq(initialProjectSeq);
			setSelectedStatusCodeList(initialStatusCodeList);
			setIsInitializing(false);

			if (initialCompanySeq && initialProjectSeq) {
				await loadWorkList({
					workCompanySeq: initialCompanySeq,
					workCompanyProjectSeq: initialProjectSeq,
					title: "",
					includeBodyYn: "N",
					workStatCdList: initialStatusCodeList,
				});
			} else {
				applyEmptyListState();
			}
		};

		void initializePage();
		return () => {
			isCancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// 선택 업무 번호가 바뀌면 상세를 다시 조회합니다.
	useEffect(() => {
		if (selectedWorkSeq === null) {
			applyDetailResponse(null);
			return;
		}

		void loadDetail(selectedWorkSeq);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedWorkSeq]);

	// 상태 전체 체크박스의 부분 선택 표시를 동기화합니다.
	useEffect(() => {
		if (!statusFilterAllInputRef.current) {
			return;
		}

		// 일부 상태만 선택된 경우 indeterminate 상태를 적용합니다.
		statusFilterAllInputRef.current.indeterminate = hasPartialStatusCodeSelection;
	}, [hasPartialStatusCodeSelection]);

	// 상태 필터 드롭다운 외부 클릭과 ESC 닫기를 처리합니다.
	useEffect(() => {
		const handleDocumentMouseDown = (event: MouseEvent) => {
			if (statusFilterRef.current?.contains(event.target as Node)) {
				return;
			}
			setStatusFilterOpen(false);
		};

		const handleWindowKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setStatusFilterOpen(false);
				if (previewImageUrl !== "") {
					setPreviewImageUrl("");
				}
			}
		};

		document.addEventListener("mousedown", handleDocumentMouseDown);
		window.addEventListener("keydown", handleWindowKeyDown);
		return () => {
			document.removeEventListener("mousedown", handleDocumentMouseDown);
			window.removeEventListener("keydown", handleWindowKeyDown);
		};
	}, [previewImageUrl]);

	// SR 가져오기 모달의 프로젝트 목록을 회사 기준으로 다시 조회합니다.
	const loadImportProjectList = async (workCompanySeqValue: string, preferredProjectSeq = "") => {
		if (!workCompanySeqValue) {
			setImportProjectList([]);
			setImportForm((prevState) => ({
				...prevState,
				workCompanyProjectSeq: "",
			}));
			return;
		}

		setIsImportProjectLoading(true);
		try {
			// 선택 회사의 프로젝트 목록을 조회해 모달 기본 프로젝트를 맞춥니다.
			const result = await fetchWorkProjectList(Number(workCompanySeqValue));
			if (!result.ok || !result.data) {
				setImportProjectList([]);
				setImportForm((prevState) => ({
					...prevState,
					workCompanyProjectSeq: "",
				}));
				setMessage(result.message || "프로젝트 목록을 불러오지 못했습니다.");
				return;
			}

			const nextProjectList = result.data;
			const hasPreferredProject = nextProjectList.some(
				(projectItem) => String(projectItem.workCompanyProjectSeq) === preferredProjectSeq,
			);
			setImportProjectList(nextProjectList);
			setImportForm((prevState) => ({
				...prevState,
				workCompanyProjectSeq: hasPreferredProject
					? preferredProjectSeq
					: (nextProjectList[0] ? String(nextProjectList[0].workCompanyProjectSeq) : ""),
			}));
		} finally {
			setIsImportProjectLoading(false);
		}
	};

	// 회사 선택이 바뀌면 프로젝트 목록을 다시 조회합니다.
	const handleChangeCompany = async (event: ChangeEvent<HTMLSelectElement>) => {
		const nextCompanySeq = Number(event.target.value) || null;
		setSelectedCompanySeq(nextCompanySeq);
		setSelectedProjectSeq(null);
		setProjectList([]);
		clearSelectedWorkState();
		if (!nextCompanySeq) {
			applyEmptyListState();
			return;
		}

		setIsActionPending(true);
		setActionPendingMessage("프로젝트 목록과 업무 목록을 불러오고 있습니다.");
		try {
			// 회사 기준 프로젝트 목록을 조회하고 첫 프로젝트 기준 목록을 다시 로드합니다.
			const result = await fetchWorkProjectList(nextCompanySeq);
			if (!result.ok || !result.data) {
				setMessage(result.message || "프로젝트 목록을 불러오지 못했습니다.");
				return;
			}

			const nextProjectList = result.data;
			const nextProjectSeq = nextProjectList[0]?.workCompanyProjectSeq ?? null;
			setProjectList(nextProjectList);
			setSelectedProjectSeq(nextProjectSeq);
			await loadWorkList({
				workCompanySeq: nextCompanySeq,
				workCompanyProjectSeq: nextProjectSeq,
				title: searchKeyword,
				includeBodyYn,
				workStatCdList: selectedStatusCodeList,
			});
		} finally {
			setIsActionPending(false);
			setActionPendingMessage("");
		}
	};

	// 프로젝트 선택이 바뀌면 목록을 다시 조회합니다.
	const handleChangeProject = async (event: ChangeEvent<HTMLSelectElement>) => {
		const nextProjectSeq = Number(event.target.value) || null;
		setSelectedProjectSeq(nextProjectSeq);
		clearSelectedWorkState();
		await loadWorkList({
			workCompanySeq: selectedCompanySeq,
			workCompanyProjectSeq: nextProjectSeq,
			title: searchKeyword,
			includeBodyYn,
			workStatCdList: selectedStatusCodeList,
		});
	};

	// SR 가져오기 모달을 열거나 닫을 때 기본 선택값을 동기화합니다.
	useEffect(() => {
		if (!isImportModalOpen) {
			setImportForm(createEmptyImportForm());
			setImportProjectList([]);
			setIsImportProjectLoading(false);
			return;
		}

		// 메인 선택값을 우선 사용하고, 없으면 첫 회사/프로젝트를 기본값으로 사용합니다.
		const nextWorkCompanySeq = resolveDefaultImportCompanySeq(companyList, selectedCompanySeq);
		const nextWorkCompanyProjectSeq = selectedProjectSeq ? String(selectedProjectSeq) : "";
		setImportForm({
			workCompanySeq: nextWorkCompanySeq,
			workCompanyProjectSeq: nextWorkCompanyProjectSeq,
			workKey: "",
		});
		void loadImportProjectList(nextWorkCompanySeq, nextWorkCompanyProjectSeq);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [companyList, isImportModalOpen, selectedCompanySeq, selectedProjectSeq]);

	// 검색 폼 제출 시 현재 검색어를 반영합니다.
	const handleSubmitSearch = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const nextKeyword = searchInput.trim();
		setSearchKeyword(nextKeyword);
		await loadWorkList({
			workCompanySeq: selectedCompanySeq,
			workCompanyProjectSeq: selectedProjectSeq,
			title: nextKeyword,
			includeBodyYn,
			workStatCdList: selectedStatusCodeList,
		});
	};

	// 상태 필터 항목을 토글하고 목록을 즉시 다시 조회합니다.
	const handleToggleStatusCode = async (workStatCd: string) => {
		const nextStatusCodeList = selectedStatusCodeList.includes(workStatCd)
			? selectedStatusCodeList.filter((codeItem) => codeItem !== workStatCd)
			: allStatusCodeList.filter((codeItem) => codeItem === workStatCd || selectedStatusCodeList.includes(codeItem));
		setSelectedStatusCodeList(nextStatusCodeList);
		await loadWorkList({
			workCompanySeq: selectedCompanySeq,
			workCompanyProjectSeq: selectedProjectSeq,
			title: searchKeyword,
			includeBodyYn,
			workStatCdList: nextStatusCodeList,
		});
	};

	// 상태 필터 전체 체크박스 변경을 반영합니다.
	const handleToggleAllStatusCodes = async (event: ChangeEvent<HTMLInputElement>) => {
		const nextStatusCodeList = event.target.checked ? allStatusCodeList : [];
		setSelectedStatusCodeList(nextStatusCodeList);
		await loadWorkList({
			workCompanySeq: selectedCompanySeq,
			workCompanyProjectSeq: selectedProjectSeq,
			title: searchKeyword,
			includeBodyYn,
			workStatCdList: nextStatusCodeList,
		});
	};

	// 상태 섹션 더보기를 처리합니다.
	const handleLoadMoreSection = async (workStatCd: string) => {
		if (!selectedCompanySeq || !selectedProjectSeq) {
			return;
		}

		const targetSection = listResponse?.statusSectionList.find((sectionItem) => sectionItem.workStatCd === workStatCd);
		if (!targetSection) {
			return;
		}

		setSectionLoadingMap((prevState) => ({ ...prevState, [workStatCd]: true }));
		try {
			// 특정 상태 코드의 다음 10건을 추가 조회해 기존 목록 뒤에 붙입니다.
			const result = await fetchWorkSectionMore({
				workCompanySeq: selectedCompanySeq,
				workCompanyProjectSeq: selectedProjectSeq,
				title: searchKeyword,
				includeBodyYn,
				workStatCd,
				offset: targetSection.list.length,
				limit: DEFAULT_SECTION_PAGE_SIZE,
			});
			if (!result.ok || !result.data) {
				setMessage(result.message || "추가 업무 목록을 불러오지 못했습니다.");
				return;
			}
			const nextSectionPage = result.data;

			setListResponse((prevState) => {
				if (!prevState) {
					return prevState;
				}
				return {
					statusSectionList: prevState.statusSectionList.map((sectionItem) => {
						if (sectionItem.workStatCd !== workStatCd) {
							return sectionItem;
						}
						const existingWorkSeqSet = new Set(sectionItem.list.map((rowItem) => rowItem.workSeq));
						const mergedList = sortWorkListRowsByCreateDt([
							...sectionItem.list,
							...nextSectionPage.list.filter((rowItem) => !existingWorkSeqSet.has(rowItem.workSeq)),
						]);
						return {
							...sectionItem,
							list: mergedList,
							totalCount: nextSectionPage.totalCount,
							hasMore: nextSectionPage.hasMore,
						};
					}),
				};
			});
		} finally {
			setSectionLoadingMap((prevState) => ({ ...prevState, [workStatCd]: false }));
		}
	};

	// 로그아웃 후 로그인 화면으로 이동합니다.
	const handleClickLogout = async () => {
		setIsActionPending(true);
		setActionPendingMessage("로그아웃하고 있습니다.");
		try {
			await logoutWork();
			await router.replace("/work/login?returnUrl=%2Fwork");
		} finally {
			setIsActionPending(false);
			setActionPendingMessage("");
		}
	};

	// 공수 입력 변경을 로컬 폼 상태에 반영합니다.
	const handleChangeDetailField = (fieldName: "itManager" | "coManager" | "workTime", value: string) => {
		setDetailEditForm((prevState) => ({
			...prevState,
			[fieldName]: value,
		}));
	};

	// blur 또는 Enter 시 텍스트/공수 입력을 저장합니다.
	const handleCommitDetailField = async (fieldName: "itManager" | "coManager" | "workTime") => {
		const nextForm = {
			...detailEditForm,
			[fieldName]: detailEditForm[fieldName],
		};
		await persistDetailForm(nextForm);
	};

	// 텍스트 입력 Enter 저장을 처리합니다.
	const handleKeyDownCommitInput = async (
		event: ReactKeyboardEvent<HTMLInputElement>,
		fieldName: "itManager" | "coManager" | "workTime",
	) => {
		if (event.key !== "Enter") {
			return;
		}
		event.preventDefault();
		await handleCommitDetailField(fieldName);
	};

	// 상태/일시 입력은 변경 즉시 저장합니다.
	const handleChangeAndPersistDetailField = async (
		fieldName: "workStatCd" | "workStartDt" | "workEndDt",
		value: string,
	) => {
		const nextForm = {
			...detailEditForm,
			[fieldName]: value,
		};
		await persistDetailForm(nextForm);
	};

	// 댓글을 저장합니다.
	const handleSaveReply = async (payload: WorkReplyComposerSubmitPayload): Promise<boolean> => {
		if (!selectedDetail) {
			return false;
		}

		setIsReplySaving(true);
		setReplySavingMessage("댓글을 등록하고 있습니다.");
		try {
			// Quill HTML 댓글과 첨부파일을 저장한 뒤 상세를 다시 조회합니다.
			const result = await createWorkReply({
				workSeq: selectedDetail.workSeq,
				replyComment: payload.replyComment,
			}, payload.newFiles);
			if (!result.ok || !result.data) {
				setMessage(result.message || "댓글 등록에 실패했습니다.");
				return false;
			}

			await loadDetail(selectedDetail.workSeq);
			showFeedbackToast("댓글을 등록했습니다.");
			return true;
		} finally {
			setIsReplySaving(false);
			setReplySavingMessage("");
		}
	};

	// 댓글 수정 모드를 시작합니다.
	const handleStartEditReply = (reply: WorkReply) => {
		setIsEditingReplyComposerImageUploading(false);
		setEditingReplySeq(reply.replySeq);
	};

	// 댓글 수정 저장을 처리합니다.
	const handleUpdateReply = async (reply: WorkReply, payload: WorkReplyComposerSubmitPayload): Promise<boolean> => {
		setIsReplySaving(true);
		setReplySavingMessage("댓글을 수정하고 있습니다.");
		try {
			// 댓글 수정 내용과 삭제/추가 첨부를 함께 저장한 뒤 상세를 다시 로드합니다.
			const result = await updateWorkReply({
				replySeq: reply.replySeq,
				workSeq: reply.workSeq,
				replyComment: payload.replyComment,
				deleteReplyFileSeqList: payload.deleteReplyFileSeqList,
			}, payload.newFiles);
			if (!result.ok || !result.data) {
				setMessage(result.message || "댓글 수정에 실패했습니다.");
				return false;
			}

			resetEditingReplyState();
			await loadDetail(reply.workSeq);
			showFeedbackToast("댓글을 수정했습니다.");
			return true;
		} finally {
			setIsReplySaving(false);
			setReplySavingMessage("");
		}
	};

	// 댓글 삭제를 처리합니다.
	const handleDeleteReply = async (reply: WorkReply) => {
		setIsReplySaving(true);
		setReplySavingMessage("댓글을 삭제하고 있습니다.");
		try {
			// 댓글을 삭제하고 상세 및 댓글 수를 최신 상태로 맞춥니다.
			const result = await deleteWorkReply({
				replySeq: reply.replySeq,
				workSeq: reply.workSeq,
			});
			if (!result.ok) {
				setMessage(result.message || "댓글 삭제에 실패했습니다.");
				return;
			}

			if (editingReplySeq === reply.replySeq) {
				resetEditingReplyState();
			}
			await loadDetail(reply.workSeq);
			showFeedbackToast("댓글을 삭제했습니다.");
		} finally {
			setIsReplySaving(false);
			setReplySavingMessage("");
		}
	};

	// 댓글 첨부파일 다운로드를 처리합니다.
	const handleDownloadReplyFile = async (replyFile: WorkReplyFile) => {
		try {
			// 댓글 첨부 다운로드 API 호출 뒤 브라우저 다운로드를 시작합니다.
			const downloadData = await downloadWorkReplyFile(replyFile.replyFileSeq);
			triggerBrowserFileDownload(downloadData.blob, downloadData.fileName || replyFile.replyFileNm || "reply-file");
		} catch (errorObject) {
			console.error("댓글 첨부파일 다운로드에 실패했습니다.", errorObject);
			setMessage("댓글 첨부파일 다운로드에 실패했습니다.");
		}
	};

	// 수기 등록 선택 파일을 갱신합니다.
	const handleChangeManualFiles = (event: ChangeEvent<HTMLInputElement>) => {
		const nextFileList = Array.from(event.target.files || []);
		if (nextFileList.length < 1) {
			return;
		}
		setManualFiles((prevState) => [...prevState, ...nextFileList]);
		event.target.value = "";
	};

	// 수기 등록 선택 파일을 제거합니다.
	const handleRemoveManualFile = (targetIndex: number) => {
		setManualFiles((prevState) => prevState.filter((_, fileIndex) => fileIndex !== targetIndex));
	};

	// 수기 등록 저장을 처리합니다.
	const handleSubmitManualCreate = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!selectedCompanySeq || !selectedProjectSeq) {
			setMessage("회사와 프로젝트를 선택해주세요.");
			return;
		}
		if (trimText(manualForm.title) === "") {
			setMessage("타이틀을 입력해주세요.");
			return;
		}
		if (trimText(manualForm.workPriorCd) === "") {
			setMessage("우선순위를 선택해주세요.");
			return;
		}

		setIsManualSaving(true);
		try {
			// 선택 회사/프로젝트 기준으로 수기 업무를 등록합니다.
			const result = await createWorkManual({
				workCompanySeq: selectedCompanySeq,
				workCompanyProjectSeq: selectedProjectSeq,
				title: manualForm.title,
				content: manualForm.content,
				coManager: manualForm.coManager,
				workPriorCd: manualForm.workPriorCd,
			}, manualFiles);
			if (!result.ok || !result.data) {
				setMessage(result.message || "업무 수기 등록에 실패했습니다.");
				return;
			}

			setIsManualModalOpen(false);
			setManualForm(createEmptyManualCreateForm());
			setManualFiles([]);
			await loadWorkList({
				workCompanySeq: selectedCompanySeq,
				workCompanyProjectSeq: selectedProjectSeq,
				title: searchKeyword,
				includeBodyYn,
				workStatCdList: selectedStatusCodeList,
				preferredWorkSeq: result.data.workSeq,
			});
			showFeedbackToast("업무를 등록했습니다.");
		} finally {
			setIsManualSaving(false);
		}
	};

	// SR 가져오기를 실행합니다.
	const handleSubmitImport = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (trimText(importForm.workCompanySeq) === "") {
			setMessage("회사를 선택해주세요.");
			return;
		}
		if (trimText(importForm.workCompanyProjectSeq) === "") {
			setMessage("프로젝트를 선택해주세요.");
			return;
		}
		if (trimText(importForm.workKey) === "") {
			setMessage("업무 키를 입력해주세요.");
			return;
		}

		setIsImportSaving(true);
		try {
			// 모달에서 선택한 회사/프로젝트 기준으로 SR 업무를 가져옵니다.
			const command: WorkImportRequest = {
				workCompanySeq: Number(importForm.workCompanySeq),
				workCompanyProjectSeq: Number(importForm.workCompanyProjectSeq),
				workKey: trimText(importForm.workKey),
			};
			const result = await importWork(command);
			if (!result.ok || !result.data) {
				setMessage(result.message || "SR 가져오기에 실패했습니다.");
				return;
			}

			setIsImportModalOpen(false);
			setImportForm(createEmptyImportForm());
			setImportProjectList([]);
			await loadWorkList({
				workCompanySeq: selectedCompanySeq,
				workCompanyProjectSeq: selectedProjectSeq,
				title: searchKeyword,
				includeBodyYn,
				workStatCdList: selectedStatusCodeList,
				preferredWorkSeq: result.data.workSeq,
			});
			showFeedbackToast(result.data.message || "SR 업무를 가져왔습니다.");
		} finally {
			setIsImportSaving(false);
		}
	};

	// SR 가져오기 모달의 회사 선택을 반영합니다.
	const handleChangeImportCompany = async (event: ChangeEvent<HTMLSelectElement>) => {
		const nextWorkCompanySeq = event.target.value;
		setImportForm((prevState) => ({
			...prevState,
			workCompanySeq: nextWorkCompanySeq,
			workCompanyProjectSeq: "",
		}));
		setImportProjectList([]);
		await loadImportProjectList(nextWorkCompanySeq);
	};

	// SR 가져오기 모달의 프로젝트 선택을 반영합니다.
	const handleChangeImportProject = (event: ChangeEvent<HTMLSelectElement>) => {
		const nextWorkCompanyProjectSeq = event.target.value;
		setImportForm((prevState) => ({
			...prevState,
			workCompanyProjectSeq: nextWorkCompanyProjectSeq,
		}));
	};

	// SR 가져오기 모달의 업무 키 입력값을 반영합니다.
	const handleChangeImportWorkKey = (event: ChangeEvent<HTMLInputElement>) => {
		const nextWorkKey = event.target.value;
		setImportForm((prevState) => ({
			...prevState,
			workKey: nextWorkKey,
		}));
	};

	// 업무 첨부파일 다운로드를 처리합니다.
	const handleDownloadWorkFile = async (workFile: WorkFile) => {
		try {
			// 업무 첨부 다운로드 API 호출 뒤 브라우저 다운로드를 시작합니다.
			const downloadData = await downloadWorkFile(workFile.workJobFileSeq);
			triggerBrowserFileDownload(downloadData.blob, downloadData.fileName || workFile.workJobFileNm || "work-file");
		} catch (errorObject) {
			console.error("업무 첨부파일 다운로드에 실패했습니다.", errorObject);
			setMessage("업무 첨부파일 다운로드에 실패했습니다.");
		}
	};

	// 댓글 수정 가능 여부를 판단합니다.
	const canEditReply = (reply: WorkReply): boolean => {
		return currentUser?.usrNo === reply.regNo;
	};

	// 업무 첨부 타일을 렌더링합니다.
	const renderWorkFileTile = (fileItem: WorkFile) => (
		<div key={fileItem.workJobFileSeq} className={styles.fileTile}>
			{isImageWorkFile(fileItem) && fileItem.workJobFileUrl ? (
				<button type="button" className={styles.filePreviewButton} onClick={() => setPreviewImageUrl(fileItem.workJobFileUrl)}>
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img src={fileItem.workJobFileUrl} alt={fileItem.workJobFileNm || "업무 첨부 이미지"} className={styles.filePreviewImage} />
				</button>
			) : (
				<button type="button" className={styles.filePreviewFallback} onClick={() => void handleDownloadWorkFile(fileItem)}>
					FILE
				</button>
			)}
			<button type="button" className={styles.fileNameButton} onClick={() => void handleDownloadWorkFile(fileItem)}>
				{fileItem.workJobFileNm || "첨부파일"}
			</button>
		</div>
	);

	// 댓글 읽기 전용 첨부 타일을 렌더링합니다.
	const renderReplyFileTile = (fileItem: WorkReplyFile) => (
		<div key={fileItem.replyFileSeq} className={styles.fileTile}>
			{isImageReplyFile(fileItem) && fileItem.replyFileUrl ? (
				<button type="button" className={styles.filePreviewButton} onClick={() => setPreviewImageUrl(fileItem.replyFileUrl)}>
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img src={fileItem.replyFileUrl} alt={fileItem.replyFileNm || "댓글 첨부 이미지"} className={styles.filePreviewImage} />
				</button>
			) : (
				<button type="button" className={styles.filePreviewFallback} onClick={() => void handleDownloadReplyFile(fileItem)}>
					FILE
				</button>
			)}
			<button type="button" className={styles.fileNameButton} onClick={() => void handleDownloadReplyFile(fileItem)}>
				{fileItem.replyFileNm || "첨부파일"}
			</button>
		</div>
	);

	// 로컬 선택 파일 타일을 렌더링합니다.
	const renderSelectedFileTile = (fileItem: File, key: string, onRemove: () => void) => (
		<div key={key} className={styles.fileTile}>
			<div className={styles.filePreviewFallback}>{isImageSelectedFile(fileItem) ? "IMG" : "FILE"}</div>
			<div className={styles.fileNameLabel}>{fileItem.name || "선택 파일"}</div>
			<button type="button" className={styles.fileDeleteButton} onClick={onRemove}>
				제거
			</button>
		</div>
	);

	return (
		<>
			<Head>
				<title>업무관리</title>
				<meta name="description" content="react-resume 업무관리 작업 화면" />
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

				{!isInitializing ? (
					<div className={styles.workspaceShell} ref={workSplitLayout.containerRef} style={workSplitLayout.layoutStyle}>
						<aside className={styles.sidebar}>
							<div className={styles.sidebarTop}>
								<div className={styles.selectRow}>
									<select className={styles.sidebarFieldControl} value={selectedCompanySeq ?? ""} onChange={(event) => void handleChangeCompany(event)} disabled={isActionPending}>
										<option value="">회사 선택</option>
										{bootstrap?.companyList.map((companyItem) => (
											<option key={companyItem.workCompanySeq} value={companyItem.workCompanySeq}>
												{companyItem.workCompanyNm}
											</option>
										))}
									</select>
									<select className={styles.sidebarFieldControl} value={selectedProjectSeq ?? ""} onChange={(event) => void handleChangeProject(event)} disabled={isActionPending || projectList.length < 1}>
										<option value="">프로젝트 선택</option>
										{projectList.map((projectItem) => (
											<option key={projectItem.workCompanyProjectSeq} value={projectItem.workCompanyProjectSeq}>
												{projectItem.workCompanyProjectNm}
											</option>
										))}
									</select>
								</div>

								<form className={styles.searchForm} onSubmit={(event) => void handleSubmitSearch(event)}>
									<div className={styles.searchInlineRow}>
										<input
											type="text"
											value={searchInput}
											onChange={(event) => setSearchInput(event.target.value)}
											className={styles.searchInput}
											placeholder="업무 제목 또는 키워드 검색"
										/>
										<button type="submit" className={styles.searchButton} disabled={isListLoading}>
											검색
										</button>
									</div>

								<div className={styles.searchSubRow}>
										<label className={styles.includeBodyLabel}>
											<input
												type="checkbox"
												checked={includeBodyYn === "Y"}
												onChange={(event) => setIncludeBodyYn(event.target.checked ? "Y" : "N")}
											/>
											본문 포함 검색
										</label>

										<div className={styles.statusComboShell} ref={statusFilterRef}>
											<button type="button" className={styles.statusComboButton} onClick={() => setStatusFilterOpen((prevState) => !prevState)}>
												{statusFilterButtonLabel}
											</button>
											{statusFilterOpen ? (
												<div className={styles.statusComboPanel}>
													<div className={styles.statusOptionList}>
														<label className={`${styles.statusOptionItem} ${styles.statusOptionAllItem}`}>
															<input
																ref={statusFilterAllInputRef}
																type="checkbox"
																checked={isAllStatusCodeSelected}
																onChange={(event) => void handleToggleAllStatusCodes(event)}
															/>
															<span className={styles.statusOptionText}>전체</span>
														</label>
														{workStatList.map((codeItem) => (
															<label key={codeItem.cd} className={styles.statusOptionItem}>
																<input
																	type="checkbox"
																	checked={selectedStatusCodeList.includes(codeItem.cd)}
																	onChange={() => void handleToggleStatusCode(codeItem.cd)}
																/>
																<span className={styles.statusOptionText}>{codeItem.cdNm}</span>
															</label>
														))}
													</div>
												</div>
											) : null}
										</div>
									</div>
								</form>
							</div>

							<div className={styles.sidebarListSection}>
								{!isListLoading && visibleStatusSectionList.length < 1 ? (
									<div className={styles.emptyState}>조회된 업무가 없습니다.</div>
								) : null}
								{visibleStatusSectionList.map((sectionItem) => (
									<section key={sectionItem.workStatCd} className={styles.statusSectionBlock}>
										<div className={styles.statusSectionHeader}>
											<h2 className={styles.statusSectionTitle}>{resolveStatusName(sectionItem.workStatCd, workStatList)}</h2>
											<span className={styles.statusSectionCount}>
												{sectionItem.list.length}/{sectionItem.totalCount}
											</span>
										</div>
										<div className={styles.statusSectionList}>
											{sectionItem.list.map((rowItem) => (
												<button
													key={rowItem.workSeq}
													type="button"
													className={`${styles.workCard} ${selectedWorkSeq === rowItem.workSeq ? styles.workCardActive : ""}`}
													onClick={() => setSelectedWorkSeq(rowItem.workSeq)}
												>
													<span className={styles.workCardTitleRow}>
														<WorkPriorityIcon workPriorCd={rowItem.workPriorCd} workPriorNm={rowItem.workPriorNm} />
														<span className={styles.workCardTitle}>{rowItem.title || rowItem.workKey || "제목 없음"}</span>
													</span>
												</button>
											))}
										</div>
										{sectionItem.hasMore ? (
											<button
												type="button"
												className={styles.loadMoreButton}
												onClick={() => void handleLoadMoreSection(sectionItem.workStatCd)}
												disabled={Boolean(sectionLoadingMap[sectionItem.workStatCd])}
											>
												{sectionLoadingMap[sectionItem.workStatCd] ? "불러오는 중..." : "더보기"}
											</button>
										) : null}
									</section>
								))}
							</div>

							<div className={styles.sidebarBottom}>
								<div className={styles.sidebarBottomRow}>
									<button type="button" className={styles.secondaryButton} onClick={() => setIsManualModalOpen(true)}>
										수기등록
									</button>
									<button type="button" className={styles.secondaryButton} onClick={() => setIsImportModalOpen(true)}>
										SR 가져오기
									</button>
								</div>
								<button type="button" className={styles.logoutButton} onClick={() => void handleClickLogout()} disabled={isActionPending}>
									로그아웃
								</button>
							</div>
						</aside>
						<div
							role="separator"
							tabIndex={workSplitLayout.isResizeEnabled ? 0 : -1}
							aria-orientation="vertical"
							aria-label="업무 화면 좌우 크기 조절"
							aria-valuemin={Math.round(workSplitLayout.minimumPrimaryWidth)}
							aria-valuemax={Math.round(workSplitLayout.maximumPrimaryWidth)}
							aria-valuenow={Math.round(workSplitLayout.primaryWidth)}
							className={`${styles.resizeHandle} ${workSplitLayout.isResizing ? styles.resizeHandleActive : ""}`}
							onPointerDown={workSplitLayout.handleResizePointerDown}
							onKeyDown={workSplitLayout.handleResizeKeyDown}
						>
							<span className={styles.resizeHandleGrip} />
						</div>

						<main className={styles.detailPanel}>
							{!isDetailLoading && !selectedDetail ? (
								<div className={styles.emptyDetailState}>좌측 목록에서 업무를 선택하면 상세를 바로 수정할 수 있습니다.</div>
							) : null}
							{selectedDetail ? (
								<div className={styles.detailContent}>
									<div className={styles.detailHeader}>
										<div className={styles.detailHeaderMeta}>
											<p className={styles.detailKey}>{selectedDetail.workKey || "WORK"}</p>
											<p className={styles.detailPath}>
												{selectedDetail.workCompanyNm} / {selectedDetail.workCompanyProjectNm}
											</p>
										</div>
										<div className={styles.detailSavingText}>{isDetailSaving ? "저장 중..." : "상태/일정/공수 수정"}</div>
									</div>

									<div className={styles.detailTitleBlock}>
										<h1 className={styles.detailTitleText}>{detailEditForm.title || "제목 없음"}</h1>
									</div>

									<div className={styles.metaRows}>
										<div className={`${styles.metaRow} ${styles.metaRowWide}`}>
											<div className={styles.metaInlineField}>
												<span className={styles.metaLabel}>IT담당자</span>
												<div className={styles.metaControl}>
													<input
														type="text"
														className={styles.metaInput}
														value={detailEditForm.itManager}
														onChange={(event) => handleChangeDetailField("itManager", event.target.value)}
														onBlur={() => void handleCommitDetailField("itManager")}
														onKeyDown={(event) => void handleKeyDownCommitInput(event, "itManager")}
														placeholder="IT담당자 입력"
													/>
												</div>
											</div>
											<div className={styles.metaInlineField}>
												<span className={styles.metaLabel}>업무담당자</span>
												<div className={styles.metaValueShell}>
													<span className={styles.metaReadonlyValue}>{trimText(detailEditForm.coManager) || "-"}</span>
												</div>
											</div>
											<div className={styles.metaInlineField}>
												<span className={styles.metaLabel}>우선순위</span>
												<div className={styles.metaValueShell}>
													<span className={styles.metaReadonlyValue}>{trimText(selectedDetail.workPriorNm) || "-"}</span>
												</div>
											</div>
											<div className={styles.metaInlineField}>
												<span className={styles.metaLabel}>업무생성일시</span>
												<div className={styles.metaValueShell}>
													<span className={styles.metaReadonlyValue}>{detailEditForm.workCreateDt || "-"}</span>
												</div>
											</div>
										</div>

										<div className={`${styles.metaRow} ${styles.metaRowCompact}`}>
											<div className={styles.metaInlineField}>
												<span className={styles.metaLabel}>상태</span>
												<div className={styles.metaControl}>
													<select
														className={styles.metaSelect}
														value={detailEditForm.workStatCd}
														onChange={(event) => void handleChangeAndPersistDetailField("workStatCd", event.target.value)}
													>
														{workStatList.map((codeItem) => (
															<option key={codeItem.cd} value={codeItem.cd}>
																{codeItem.cdNm}
															</option>
														))}
													</select>
												</div>
											</div>
											<div className={styles.metaInlineField}>
												<span className={styles.metaLabel}>업무 시작</span>
												<div className={styles.metaControl}>
													<AdminDateInput
														className={styles.metaDateInput}
														wrapperClassName={styles.metaDateInputWrapper}
														value={detailEditForm.workStartDt}
														onChange={(event) => void handleChangeAndPersistDetailField("workStartDt", event.target.value)}
													/>
												</div>
											</div>
											<div className={styles.metaInlineField}>
												<span className={styles.metaLabel}>업무 종료</span>
												<div className={styles.metaControl}>
													<AdminDateInput
														className={styles.metaDateInput}
														wrapperClassName={styles.metaDateInputWrapper}
														value={detailEditForm.workEndDt}
														onChange={(event) => void handleChangeAndPersistDetailField("workEndDt", event.target.value)}
													/>
												</div>
											</div>
											<div className={styles.metaInlineField}>
												<span className={styles.metaLabel}>공수</span>
												<div className={styles.metaControl}>
													<input
														type="number"
														min="0"
														className={styles.metaInput}
														value={detailEditForm.workTime}
														onChange={(event) => handleChangeDetailField("workTime", event.target.value)}
														onBlur={() => void handleCommitDetailField("workTime")}
														onKeyDown={(event) => void handleKeyDownCommitInput(event, "workTime")}
													/>
												</div>
											</div>
										</div>
									</div>

									<section className={styles.detailSection}>
										<div className={styles.sectionHeader}>
											<h2 className={styles.sectionTitle}>본문</h2>
											<span className={styles.sectionHint}>읽기 전용</span>
										</div>
										<WorkReadonlyHtml
											value={detailEditForm.content}
											emptyText="등록된 본문이 없습니다."
											className={`${styles.readonlyContent} quill-content`}
										/>
									</section>

									<section className={styles.detailSection}>
										<div className={styles.sectionHeader}>
											<h2 className={styles.sectionTitle}>첨부파일</h2>
											<span className={styles.sectionHint}>읽기 전용 첨부</span>
										</div>
										{(detailResponse?.fileList.length ?? 0) < 1 ? (
											<div className={styles.emptyState}>첨부파일이 없습니다.</div>
										) : (
											<div className={styles.fileTileGrid}>
												{detailResponse?.fileList.map((fileItem) => renderWorkFileTile(fileItem))}
											</div>
										)}
									</section>

									<section className={styles.detailSection}>
										<div className={styles.sectionHeader}>
											<h2 className={styles.sectionTitle}>댓글 목록</h2>
											<span className={styles.sectionHint}>{detailResponse?.replyList.length ?? 0}개</span>
										</div>
										{(detailResponse?.replyList.length ?? 0) < 1 ? (
											<div className={styles.emptyState}>등록된 댓글이 없습니다.</div>
										) : (
											<div className={styles.replyList}>
												{detailResponse?.replyList.map((replyItem) => (
													<article key={replyItem.replySeq} className={styles.replyCard}>
														<div className={styles.replyHeader}>
															<div className={styles.replyMeta}>
																<span>등록 {replyItem.regDt || "-"}</span>
																<span>수정 {replyItem.udtDt || "-"}</span>
															</div>
															{canEditReply(replyItem) ? (
																<div className={styles.replyHeaderActions}>
																	<button type="button" className={styles.inlineActionButton} onClick={() => handleStartEditReply(replyItem)}>
																		수정
																	</button>
																	<button type="button" className={styles.inlineDangerButton} onClick={() => void handleDeleteReply(replyItem)} disabled={isReplySaving}>
																		삭제
																	</button>
																</div>
															) : null}
														</div>

														{editingReplySeq === replyItem.replySeq ? (
															<WorkReplyComposer
																key={`work-reply-edit-${replyItem.workSeq}-${replyItem.replySeq}`}
																mode="edit"
																workSeq={replyItem.workSeq}
																replySeq={replyItem.replySeq}
																initialHtml={replyItem.replyComment || ""}
																existingFiles={replyItem.replyFileList}
																isSubmitting={isReplySaving}
																onSubmit={(payload) => handleUpdateReply(replyItem, payload)}
																onCancel={resetEditingReplyState}
																onError={setMessage}
																onPreviewImage={setPreviewImageUrl}
																onDownloadFile={(fileItem) => void handleDownloadReplyFile(fileItem)}
																onInlineImageUploadingChange={setIsEditingReplyComposerImageUploading}
															/>
														) : (
															<>
																<WorkReadonlyHtml
																	value={replyItem.replyComment || ""}
																	emptyText={replyItem.replyFileList.length > 0 ? "첨부파일만 등록된 댓글입니다." : "댓글 내용이 없습니다."}
																	className={`${styles.replyContent} quill-content`}
																/>
																{replyItem.replyFileList.length > 0 ? (
																	<div className={styles.fileTileGrid}>
																		{replyItem.replyFileList.map((fileItem) => renderReplyFileTile(fileItem))}
																	</div>
																) : null}
															</>
														)}
													</article>
												))}
											</div>
										)}
									</section>

									<section className={styles.detailSection}>
										<div className={styles.sectionHeader}>
											<h2 className={styles.sectionTitle}>댓글쓰기</h2>
											<span className={styles.sectionHint}>react-quill-new 적용</span>
										</div>
										<WorkReplyComposer
											key={`work-reply-create-${selectedDetail.workSeq}`}
											mode="create"
											workSeq={selectedDetail.workSeq}
											initialHtml=""
											isSubmitting={isReplySaving}
											onSubmit={handleSaveReply}
											onError={setMessage}
											onPreviewImage={setPreviewImageUrl}
											onDownloadFile={(fileItem) => void handleDownloadReplyFile(fileItem)}
											onInlineImageUploadingChange={setIsReplyComposerImageUploading}
										/>
									</section>
								</div>
							) : null}
						</main>
					</div>
				) : null}

				{isManualModalOpen ? (
					<WorkModalShell title="업무 수기등록" onClose={() => !isManualSaving && setIsManualModalOpen(false)}>
						<form className={styles.modalForm} onSubmit={(event) => void handleSubmitManualCreate(event)}>
							<label className={styles.modalFieldLabel}>
								타이틀
								<input type="text" className={styles.modalFieldControl} value={manualForm.title} onChange={(event) => setManualForm((prevState) => ({ ...prevState, title: event.target.value }))} />
							</label>
							<label className={styles.modalFieldLabel}>
								업무 담당자
								<input type="text" className={styles.modalFieldControl} value={manualForm.coManager} onChange={(event) => setManualForm((prevState) => ({ ...prevState, coManager: event.target.value }))} />
							</label>
							<label className={styles.modalFieldLabel}>
								우선순위
								<select className={styles.modalFieldControl} value={manualForm.workPriorCd} onChange={(event) => setManualForm((prevState) => ({ ...prevState, workPriorCd: event.target.value }))}>
									<option value="">우선순위 선택</option>
									{workPriorList.map((codeItem) => (
										<option key={codeItem.cd} value={codeItem.cd}>
											{codeItem.cdNm}
										</option>
									))}
								</select>
							</label>
							<label className={styles.modalFieldLabel}>
								본문
								<textarea className={styles.modalTextarea} value={manualForm.content} onChange={(event) => setManualForm((prevState) => ({ ...prevState, content: event.target.value }))} />
							</label>
							<div className={styles.fileTileGrid}>
								{manualFiles.map((fileItem, fileIndex) => renderSelectedFileTile(fileItem, `manual-${fileIndex}`, () => handleRemoveManualFile(fileIndex)))}
								<label className={`${styles.fileTile} ${styles.fileTileAdd}`}>
									<span className={styles.fileAddIcon}>+</span>
									<span className={styles.fileNameLabel}>파일 추가</span>
									<input type="file" multiple className={styles.hiddenFileInput} onChange={handleChangeManualFiles} />
								</label>
							</div>
							<div className={styles.modalActionRow}>
								<button type="submit" className={styles.primaryButton} disabled={isManualSaving}>
									{isManualSaving ? "등록 중..." : "등록"}
								</button>
								<button type="button" className={styles.secondaryButton} onClick={() => setIsManualModalOpen(false)} disabled={isManualSaving}>
									취소
								</button>
							</div>
						</form>
					</WorkModalShell>
				) : null}

				{isImportModalOpen ? (
					<WorkModalShell title="SR 가져오기" onClose={() => !isImportSaving && setIsImportModalOpen(false)}>
						<form className={styles.modalForm} onSubmit={(event) => void handleSubmitImport(event)}>
							<div className={styles.importSelectRow}>
								<label className={styles.modalFieldLabel}>
									회사
									<select
										className={styles.modalFieldControl}
										value={importForm.workCompanySeq}
										onChange={(event) => void handleChangeImportCompany(event)}
										disabled={isImportSaving}
									>
										<option value="" disabled>회사를 선택하세요</option>
										{companyList.map((companyItem) => (
											<option key={companyItem.workCompanySeq} value={companyItem.workCompanySeq}>
												{companyItem.workCompanyNm}
											</option>
										))}
									</select>
								</label>
								<label className={styles.modalFieldLabel}>
									프로젝트
									<select
										className={styles.modalFieldControl}
										value={importForm.workCompanyProjectSeq}
										onChange={handleChangeImportProject}
										disabled={!importForm.workCompanySeq || isImportProjectLoading || isImportSaving}
									>
										<option value="" disabled>{importProjectPlaceholderText}</option>
										{importProjectList.map((projectItem) => (
											<option key={projectItem.workCompanyProjectSeq} value={projectItem.workCompanyProjectSeq}>
												{projectItem.workCompanyProjectNm}
											</option>
										))}
									</select>
								</label>
							</div>
							<label className={styles.modalFieldLabel}>
								업무 키
								<input
									type="text"
									className={styles.modalFieldControl}
									value={importForm.workKey}
									onChange={handleChangeImportWorkKey}
									placeholder="예: SR-0001"
								/>
							</label>
							<div className={styles.modalActionRow}>
								<button type="submit" className={styles.primaryButton} disabled={isImportProjectLoading || isImportSaving}>
									{isImportSaving ? "가져오는 중..." : "가져오기"}
								</button>
								<button type="button" className={styles.secondaryButton} onClick={() => setIsImportModalOpen(false)} disabled={isImportSaving}>
									취소
								</button>
							</div>
						</form>
					</WorkModalShell>
				) : null}

				{previewImageUrl !== "" ? (
					<div className={styles.previewOverlay} onClick={() => setPreviewImageUrl("")}>
						<div className={styles.previewDialog} onClick={(event) => event.stopPropagation()}>
							<button type="button" className={styles.modalCloseButton} onClick={() => setPreviewImageUrl("")}>
								닫기
							</button>
							{/* eslint-disable-next-line @next/next/no-img-element */}
							<img src={previewImageUrl} alt="첨부 미리보기" className={styles.previewImage} />
						</div>
					</div>
				) : null}
			</div>
		</>
	);
}
