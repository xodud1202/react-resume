import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import FeedbackLayer from "@/components/common/FeedbackLayer";
import useFeedbackLayer from "@/components/common/useFeedbackLayer";
import useResizableSplitLayout from "@/components/common/useResizableSplitLayout";
import AdminDateInput from "@/components/work/AdminDateInput";
import type { VacationBootstrapResponse, VacationCreateRequest, VacationListResponse } from "@/components/vacation/types";
import { createVacation, fetchVacationBootstrap, fetchVacationList } from "@/services/vacationApiService";
import { logoutWork, refreshWorkSession } from "@/services/workApiService";
import styles from "./VacationWorkspacePage.module.css";

const VACATION_PAGE_PATH = "/work/vacation";
const MORNING_HALF_VACATION_CODE = "VACATION_02";
const AFTERNOON_HALF_VACATION_CODE = "VACATION_03";

interface VacationCreateFormState {
	// 선택한 휴가자 번호 문자열입니다.
	personSeq: string;
	// 선택한 회사 번호 문자열입니다.
	workCompanySeq: string;
	// 선택한 휴가 구분 코드입니다.
	vacationCd: string;
	// 시작일입니다.
	startDt: string;
	// 종료일입니다.
	endDt: string;
	// 휴가 사유입니다.
	vacationMemo: string;
}

interface VacationModalShellProps {
	// 레이어팝업 제목입니다.
	title: string;
	// 닫기 처리입니다.
	onClose: () => void;
	// 팝업 본문입니다.
	children: ReactNode;
}

// returnUrl을 업무관리 하위 경로로만 제한합니다.
function resolveSafeReturnUrl(value: string | string[] | undefined): string {
	const rawValue = Array.isArray(value) ? value[0] ?? "" : value ?? "";
	const normalizedValue = rawValue.trim();
	if (!normalizedValue.startsWith("/work")) {
		return VACATION_PAGE_PATH;
	}
	return normalizedValue;
}

// 문자열을 trim 처리합니다.
function trimText(value: string): string {
	return value.trim();
}

// 빈 휴가 등록 폼 상태를 생성합니다.
function createEmptyVacationCreateForm(): VacationCreateFormState {
	return {
		personSeq: "",
		workCompanySeq: "",
		vacationCd: "",
		startDt: "",
		endDt: "",
		vacationMemo: "",
	};
}

// 빈 휴가 목록 응답 상태를 생성합니다.
function createEmptyVacationListResponse(): VacationListResponse {
	return {
		selectedWorkCompanySeq: null,
		yearList: [],
		selectedYear: null,
		summaryList: [],
		vacationList: [],
	};
}

// select 문자열 값을 양수로 변환합니다.
function parseRequiredSelectNumber(value: string, message: string): number {
	const parsedValue = Number(value);
	if (!Number.isInteger(parsedValue) || parsedValue < 1) {
		throw new Error(message);
	}
	return parsedValue;
}

// 휴가 숫자를 화면 표시용 문자열로 변환합니다.
function formatVacationNumber(value: number): string {
	if (!Number.isFinite(value)) {
		return "0";
	}
	return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

// 휴가 등록 시작일에서 연도를 추출합니다.
function resolveVacationYearFromDate(dateText: string): number | null {
	const parsedYear = Number(dateText.slice(0, 4));
	return Number.isInteger(parsedYear) && parsedYear > 0 ? parsedYear : null;
}

// 선택한 휴가구분이 반차인지 확인합니다.
function isHalfVacationCode(vacationCd: string): boolean {
	return vacationCd === MORNING_HALF_VACATION_CODE || vacationCd === AFTERNOON_HALF_VACATION_CODE;
}

// 날짜 문자열의 순서가 역전되었는지 확인합니다.
function isEndDateBeforeStartDate(startDt: string, endDt: string): boolean {
	if (startDt === "" || endDt === "") {
		return false;
	}
	return endDt < startDt;
}

// 휴가 등록 요청 객체를 생성합니다.
function buildVacationCreateRequest(form: VacationCreateFormState): VacationCreateRequest {
	const personSeq = parseRequiredSelectNumber(form.personSeq, "이름을 선택해주세요.");
	const workCompanySeq = parseRequiredSelectNumber(form.workCompanySeq, "회사를 선택해주세요.");
	const vacationCd = trimText(form.vacationCd);
	const startDt = trimText(form.startDt);
	const endDt = trimText(form.endDt);

	if (vacationCd === "") {
		throw new Error("휴가구분을 선택해주세요.");
	}
	if (startDt === "") {
		throw new Error("시작일을 선택해주세요.");
	}
	if (endDt === "") {
		throw new Error("종료일을 선택해주세요.");
	}
	if (isEndDateBeforeStartDate(startDt, endDt)) {
		throw new Error("종료일은 시작일보다 빠를 수 없습니다.");
	}
	if (isHalfVacationCode(vacationCd) && startDt !== endDt) {
		throw new Error("반차는 시작일과 종료일이 같아야 합니다.");
	}

	return {
		personSeq,
		workCompanySeq,
		vacationCd,
		startDt,
		endDt,
		vacationMemo: trimText(form.vacationMemo),
	};
}

// 휴가관리 레이어팝업 공통 shell을 렌더링합니다.
function VacationModalShell({ title, onClose, children }: VacationModalShellProps) {
	return (
		<div className={styles.modalOverlay} onClick={onClose}>
			<div className={styles.modalDialog} onClick={(event) => event.stopPropagation()}>
				<div className={styles.modalHeader}>
					<h2 className={styles.modalTitle}>{title}</h2>
					<button type="button" className={styles.modalIconButton} onClick={onClose} aria-label="닫기">
						×
					</button>
				</div>
				<div className={styles.modalBody}>{children}</div>
			</div>
		</div>
	);
}

// 휴가관리 메인 화면을 렌더링합니다.
export default function VacationWorkspacePage() {
	const router = useRouter();
	const splitLayout = useResizableSplitLayout({
		defaultPrimaryWidth: 320,
		minPrimaryWidth: 280,
		maxPrimaryWidth: 1380,
		maxPrimaryWidthRatio: 0.78,
		minSecondaryWidth: 260,
		collapseBreakpoint: 1024,
		primaryWidthCssVar: "--vacation-sidebar-width",
	});
	const { successMessage, isSuccessVisible, errorMessage, showSuccess, showError, clearError } = useFeedbackLayer();
	const [isInitializing, setIsInitializing] = useState(true);
	const [isListLoading, setIsListLoading] = useState(false);
	const [isActionPending, setIsActionPending] = useState(false);
	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
	const [isCreateSaving, setIsCreateSaving] = useState(false);
	const [bootstrap, setBootstrap] = useState<VacationBootstrapResponse | null>(null);
	const [listResponse, setListResponse] = useState<VacationListResponse>(createEmptyVacationListResponse);
	const [selectedPersonSeq, setSelectedPersonSeq] = useState<number | null>(null);
	const [selectedCompanySeq, setSelectedCompanySeq] = useState<number | null>(null);
	const [selectedVacationYear, setSelectedVacationYear] = useState<number | null>(null);
	const [createForm, setCreateForm] = useState<VacationCreateFormState>(createEmptyVacationCreateForm);

	const companyList = useMemo(() => bootstrap?.companyList ?? [], [bootstrap]);
	const personList = useMemo(() => bootstrap?.personList ?? [], [bootstrap]);
	const vacationCodeList = useMemo(() => bootstrap?.vacationCodeList ?? [], [bootstrap]);
	const favoritePersonList = useMemo(() => personList.filter((personItem) => personItem.favoriteYn === "Y"), [personList]);
	const normalPersonList = useMemo(() => personList.filter((personItem) => personItem.favoriteYn !== "Y"), [personList]);
	const selectedPerson = useMemo(
		() => personList.find((personItem) => personItem.personSeq === selectedPersonSeq) ?? null,
		[personList, selectedPersonSeq],
	);
	const selectedCompany = useMemo(
		() => companyList.find((companyItem) => companyItem.workCompanySeq === selectedCompanySeq) ?? null,
		[companyList, selectedCompanySeq],
	);
	const blockingLoadingMessage = isInitializing
		? "휴가관리 화면을 준비하고 있습니다."
		: isActionPending
			? "요청을 처리하고 있습니다."
			: isCreateSaving
				? "휴가를 등록하고 있습니다."
				: isListLoading
					? "휴가 목록을 불러오고 있습니다."
					: "";

	// 선택 조건 기준으로 휴가년도, 휴가 요약, 휴가 목록을 조회합니다.
	const loadVacationList = async (personSeq: number | null, workCompanySeq: number | null, vacationYear: number | null, useDefaultCompany: boolean) => {
		setIsListLoading(true);
		try {
			const result = await fetchVacationList({
				personSeq,
				workCompanySeq,
				vacationYear,
				defaultCompanyYn: useDefaultCompany ? "Y" : null,
			});
			if (!result.ok || !result.data) {
				showError(result.message || "휴가 목록을 불러오지 못했습니다.");
				setListResponse(createEmptyVacationListResponse());
				setSelectedCompanySeq(null);
				setSelectedVacationYear(null);
				return;
			}
			setListResponse(result.data);
			setSelectedCompanySeq(result.data.selectedWorkCompanySeq);
			setSelectedVacationYear(result.data.selectedYear);
		} finally {
			setIsListLoading(false);
		}
	};

	// 화면 진입 시 업무관리 세션과 휴가관리 초기 데이터를 확인합니다.
	useEffect(() => {
		if (!router.isReady) {
			return;
		}

		let isCancelled = false;

		// 로그인 세션을 복구한 뒤 휴가관리 화면 데이터를 초기화합니다.
		const initializePage = async () => {
			const sessionResult = await refreshWorkSession();
			if (isCancelled) {
				return;
			}
			if (!sessionResult.ok || !sessionResult.data?.authenticated) {
				await router.replace(`/work/login?returnUrl=${encodeURIComponent(resolveSafeReturnUrl(router.asPath || VACATION_PAGE_PATH))}`);
				return;
			}

			const bootstrapResult = await fetchVacationBootstrap();
			if (isCancelled) {
				return;
			}
			if (!bootstrapResult.ok || !bootstrapResult.data) {
				showError(bootstrapResult.message || "휴가관리 초기 데이터를 불러오지 못했습니다.");
				setIsInitializing(false);
				return;
			}

			setBootstrap(bootstrapResult.data);
			setSelectedPersonSeq(null);
			setSelectedCompanySeq(null);
			setSelectedVacationYear(null);
			setIsInitializing(false);
			await loadVacationList(null, null, null, true);
		};

		void initializePage();
		return () => {
			isCancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [router.isReady]);

	// 전체 휴가자 필터를 선택합니다.
	const handleClickAllPerson = async () => {
		setSelectedPersonSeq(null);
		await loadVacationList(null, null, null, true);
	};

	// 휴가자 필터를 선택합니다.
	const handleClickPerson = async (personSeq: number) => {
		setSelectedPersonSeq(personSeq);
		await loadVacationList(personSeq, null, null, true);
	};

	// 회사 필터를 선택합니다.
	const handleChangeCompany = async (workCompanySeq: number | null) => {
		setSelectedCompanySeq(workCompanySeq);
		await loadVacationList(selectedPersonSeq, workCompanySeq, null, false);
	};

	// 휴가년도 필터를 선택합니다.
	const handleChangeVacationYear = async (event: ChangeEvent<HTMLSelectElement>) => {
		const vacationYear = Number(event.target.value);
		if (!Number.isInteger(vacationYear) || vacationYear < 1) {
			return;
		}
		setSelectedVacationYear(vacationYear);
		await loadVacationList(selectedPersonSeq, selectedCompanySeq, vacationYear, false);
	};

	// 휴가 등록 팝업을 기본 선택값과 함께 엽니다.
	const handleOpenCreateModal = () => {
		setCreateForm({
			...createEmptyVacationCreateForm(),
			personSeq: selectedPersonSeq === null ? "" : String(selectedPersonSeq),
			workCompanySeq: selectedCompanySeq === null ? "" : String(selectedCompanySeq),
			vacationCd: vacationCodeList[0]?.cd ?? "",
		});
		setIsCreateModalOpen(true);
	};

	// 휴가 등록 요청을 제출합니다.
	const handleSubmitCreate = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		let request: VacationCreateRequest;
		try {
			request = buildVacationCreateRequest(createForm);
		} catch (error) {
			showError(error instanceof Error ? error.message : "휴가 등록 요청 정보를 확인해주세요.");
			return;
		}

		setIsCreateSaving(true);
		try {
			const result = await createVacation(request);
			if (!result.ok || !result.data) {
				showError(result.message || "휴가 등록에 실패했습니다.");
				return;
			}

			setIsCreateModalOpen(false);
			showSuccess(result.data.message || "휴가가 등록되었습니다.");
			await loadVacationList(selectedPersonSeq, selectedCompanySeq, resolveVacationYearFromDate(request.startDt), false);
		} finally {
			setIsCreateSaving(false);
		}
	};

	// 로그아웃 후 휴가관리 returnUrl을 유지한 로그인 화면으로 이동합니다.
	const handleClickLogout = async () => {
		setIsActionPending(true);
		try {
			await logoutWork();
			await router.replace(`/work/login?returnUrl=${encodeURIComponent(VACATION_PAGE_PATH)}`);
		} finally {
			setIsActionPending(false);
		}
	};

	return (
		<>
			<Head>
				<title>휴가관리</title>
				<meta name="description" content="react-resume 휴가관리" />
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
					<div className={styles.workspaceShell} ref={splitLayout.containerRef} style={splitLayout.layoutStyle}>
						<aside className={styles.sidebar}>
							<div className={styles.sidebarHeader}>
								<p className={styles.sidebarMeta}>{bootstrap?.currentUser?.userNm || "업무관리 사용자"}</p>
								<p className={styles.eyebrow}>Vacation</p>
							</div>

							<div className={styles.sidebarListArea}>
								<section className={styles.personSection}>
									<button
										type="button"
										className={`${styles.personButton} ${selectedPersonSeq === null ? styles.personButtonActive : ""}`}
										onClick={() => void handleClickAllPerson()}
										disabled={isListLoading}
									>
										<span className={styles.personName}>전체</span>
									</button>
								</section>

								<section className={`${styles.personSection} ${styles.personSectionScrollable}`}>
									<div className={styles.sectionTitleRow}>
										<h2 className={styles.sectionTitle}>즐겨찾기</h2>
										<span className={styles.sectionCount}>{favoritePersonList.length}</span>
									</div>
									{favoritePersonList.length < 1 ? <p className={styles.emptyText}>즐겨찾기 휴가자가 없습니다.</p> : null}
									<div className={styles.personList}>
										{favoritePersonList.map((personItem) => (
											<button
												key={personItem.personSeq}
												type="button"
												className={`${styles.personButton} ${selectedPersonSeq === personItem.personSeq ? styles.personButtonActive : ""}`}
												onClick={() => void handleClickPerson(personItem.personSeq)}
												disabled={isListLoading}
											>
												<span className={styles.personName}>{personItem.personNm}</span>
											</button>
										))}
									</div>
								</section>

								<section className={`${styles.personSection} ${styles.personSectionScrollable}`}>
									<div className={styles.sectionTitleRow}>
										<h2 className={styles.sectionTitle}>휴가자</h2>
										<span className={styles.sectionCount}>{normalPersonList.length}</span>
									</div>
									{normalPersonList.length < 1 ? <p className={styles.emptyText}>일반 휴가자가 없습니다.</p> : null}
									<div className={styles.personList}>
										{normalPersonList.map((personItem) => (
											<button
												key={personItem.personSeq}
												type="button"
												className={`${styles.personButton} ${selectedPersonSeq === personItem.personSeq ? styles.personButtonActive : ""}`}
												onClick={() => void handleClickPerson(personItem.personSeq)}
												disabled={isListLoading}
											>
												<span className={styles.personName}>{personItem.personNm}</span>
											</button>
										))}
									</div>
								</section>
							</div>

							<div className={styles.sidebarFooter}>
								<button type="button" className={styles.primaryButton} onClick={handleOpenCreateModal} disabled={companyList.length < 1 || personList.length < 1}>
									휴가등록
								</button>
								<button type="button" className={styles.secondaryButton} onClick={() => void handleClickLogout()} disabled={isActionPending}>
									로그아웃
								</button>
							</div>
						</aside>

						<div
							role="separator"
							tabIndex={splitLayout.isResizeEnabled ? 0 : -1}
							aria-orientation="vertical"
							aria-label={`좌측 패널 너비 조절, 현재 ${splitLayout.primaryWidth}px`}
							aria-valuemin={Math.round(splitLayout.minimumPrimaryWidth)}
							aria-valuemax={Math.round(splitLayout.maximumPrimaryWidth)}
							aria-valuenow={Math.round(splitLayout.primaryWidth)}
							className={`${styles.resizeHandle} ${splitLayout.isResizing ? styles.resizeHandleActive : ""}`}
							onPointerDown={splitLayout.handleResizePointerDown}
							onKeyDown={splitLayout.handleResizeKeyDown}
						>
							<span className={styles.resizeHandleGrip} />
						</div>

						<main className={styles.contentPanel}>
							<header className={styles.contentHeader}>
								<div>
									<p className={styles.eyebrow}>Vacation List</p>
									<h2 className={styles.contentTitle}>휴가리스트</h2>
								</div>
								<div className={styles.selectedSummary}>
									<span>{selectedPerson?.personNm ?? "전체 휴가자"}</span>
									<span>{selectedCompany?.workCompanyNm ?? "전체 회사"}</span>
								</div>
							</header>

							<section className={styles.companyFilterSection}>
								<label className={styles.yearFilterControl}>
									<span>년도</span>
									<select
										className={styles.yearSelect}
										value={selectedVacationYear ?? ""}
										onChange={(event) => void handleChangeVacationYear(event)}
										disabled={isListLoading || listResponse.yearList.length < 1}
									>
										{listResponse.yearList.length < 1 ? <option value="">년도 없음</option> : null}
										{listResponse.yearList.map((vacationYear) => (
											<option key={vacationYear} value={vacationYear}>
												{vacationYear}
											</option>
										))}
									</select>
								</label>
								<label className={`${styles.companyRadio} ${selectedCompanySeq === null ? styles.companyRadioActive : ""}`}>
									<input
										type="radio"
										name="vacation-company"
										checked={selectedCompanySeq === null}
										onChange={() => void handleChangeCompany(null)}
									/>
									<span>전체</span>
								</label>
								{companyList.map((companyItem) => (
									<label
										key={companyItem.workCompanySeq}
										className={`${styles.companyRadio} ${selectedCompanySeq === companyItem.workCompanySeq ? styles.companyRadioActive : ""}`}
									>
										<input
											type="radio"
											name="vacation-company"
											checked={selectedCompanySeq === companyItem.workCompanySeq}
											onChange={() => void handleChangeCompany(companyItem.workCompanySeq)}
										/>
										<span>{companyItem.workCompanyNm}</span>
									</label>
								))}
							</section>

							<section className={styles.tableSection}>
								<div className={styles.sectionHeader}>
									<h3 className={styles.contentSectionTitle}>연차 토탈 정보</h3>
								</div>
								<div className={styles.tableScroller}>
									<table className={`${styles.dataTable} ${styles.summaryTable}`}>
										<thead>
											<tr>
												<th>이름</th>
												<th>회사</th>
												<th>전체연차</th>
												<th>소진연차</th>
												<th>연차</th>
												<th>오전반차</th>
												<th>오후반차</th>
												<th>잔여휴가</th>
											</tr>
										</thead>
										<tbody>
											{listResponse.summaryList.length < 1 ? (
												<tr>
													<td colSpan={8} className={styles.emptyTableCell}>연차 정보가 없습니다.</td>
												</tr>
											) : null}
											{listResponse.summaryList.map((summaryItem) => (
												<tr key={`${summaryItem.personSeq}-${summaryItem.workCompanySeq}`}>
													<td>{summaryItem.personNm}</td>
													<td>{summaryItem.workCompanyNm}</td>
													<td>{formatVacationNumber(summaryItem.vacationLimitCnt)}</td>
													<td>{formatVacationNumber(summaryItem.usedVacationCnt)}</td>
													<td>{formatVacationNumber(summaryItem.fullVacationCnt)}</td>
													<td>{formatVacationNumber(summaryItem.morningHalfCnt)}</td>
													<td>{formatVacationNumber(summaryItem.afternoonHalfCnt)}</td>
													<td>{formatVacationNumber(summaryItem.remainingVacationCnt)}</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</section>

							<section className={styles.tableSection}>
								<div className={styles.sectionHeader}>
									<h3 className={styles.contentSectionTitle}>연차 사용 리스트</h3>
									<span className={styles.listCount}>{listResponse.vacationList.length}건</span>
								</div>
								<div className={styles.tableScroller}>
									<table className={`${styles.dataTable} ${styles.vacationTable}`}>
										<thead>
											<tr>
												<th>이름</th>
												<th>회사</th>
												<th>사용구분</th>
												<th>시작일</th>
												<th>종료일</th>
												<th>사용일</th>
												<th>휴가사유</th>
											</tr>
										</thead>
										<tbody>
											{listResponse.vacationList.length < 1 ? (
												<tr>
													<td colSpan={7} className={styles.emptyTableCell}>등록된 휴가 사용 내역이 없습니다.</td>
												</tr>
											) : null}
											{listResponse.vacationList.map((vacationItem) => (
												<tr key={vacationItem.vacationSeq}>
													<td>{vacationItem.personNm}</td>
													<td>{vacationItem.workCompanyNm}</td>
													<td>{vacationItem.vacationNm}</td>
													<td>{vacationItem.startDt}</td>
													<td>{vacationItem.endDt}</td>
													<td>{formatVacationNumber(vacationItem.useDayCnt)}</td>
													<td className={styles.memoCell}>{vacationItem.vacationMemo || "-"}</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</section>
						</main>
					</div>
				) : null}

				{isCreateModalOpen ? (
					<VacationModalShell title="휴가등록" onClose={() => !isCreateSaving && setIsCreateModalOpen(false)}>
						<form className={styles.modalForm} onSubmit={(event) => void handleSubmitCreate(event)}>
							<label className={styles.modalFieldLabel}>
								이름
								<select
									className={styles.modalFieldControl}
									value={createForm.personSeq}
									onChange={(event) => setCreateForm((prevState) => ({ ...prevState, personSeq: event.target.value }))}
									disabled={isCreateSaving}
								>
									<option value="">이름 선택</option>
									{personList.map((personItem) => (
										<option key={personItem.personSeq} value={personItem.personSeq}>
											{personItem.personNm}
										</option>
									))}
								</select>
							</label>

							<label className={styles.modalFieldLabel}>
								회사
								<select
									className={styles.modalFieldControl}
									value={createForm.workCompanySeq}
									onChange={(event) => setCreateForm((prevState) => ({ ...prevState, workCompanySeq: event.target.value }))}
									disabled={isCreateSaving}
								>
									<option value="">회사 선택</option>
									{companyList.map((companyItem) => (
										<option key={companyItem.workCompanySeq} value={companyItem.workCompanySeq}>
											{companyItem.workCompanyNm}
										</option>
									))}
								</select>
							</label>

							<label className={styles.modalFieldLabel}>
								휴가구분
								<select
									className={styles.modalFieldControl}
									value={createForm.vacationCd}
									onChange={(event) => setCreateForm((prevState) => ({ ...prevState, vacationCd: event.target.value }))}
									disabled={isCreateSaving}
								>
									<option value="">휴가구분 선택</option>
									{vacationCodeList.map((codeItem) => (
										<option key={codeItem.cd} value={codeItem.cd}>
											{codeItem.cdNm}
										</option>
									))}
								</select>
							</label>

							<div className={styles.modalDateRow}>
								<label className={styles.modalFieldLabel}>
									시작일
									<AdminDateInput
										value={createForm.startDt}
										onChange={(event) => setCreateForm((prevState) => ({ ...prevState, startDt: event.target.value }))}
										disabled={isCreateSaving}
									/>
								</label>
								<label className={styles.modalFieldLabel}>
									종료일
									<AdminDateInput
										value={createForm.endDt}
										onChange={(event) => setCreateForm((prevState) => ({ ...prevState, endDt: event.target.value }))}
										disabled={isCreateSaving}
									/>
								</label>
							</div>

							<label className={styles.modalFieldLabel}>
								사유
								<input
									type="text"
									className={styles.modalFieldControl}
									value={createForm.vacationMemo}
									onChange={(event) => setCreateForm((prevState) => ({ ...prevState, vacationMemo: event.target.value }))}
									disabled={isCreateSaving}
								/>
							</label>

							<div className={styles.modalActionRow}>
								<button type="submit" className={styles.primaryButton} disabled={isCreateSaving}>
									{isCreateSaving ? "등록 중..." : "등록"}
								</button>
								<button type="button" className={styles.secondaryButton} onClick={() => setIsCreateModalOpen(false)} disabled={isCreateSaving}>
									취소
								</button>
							</div>
						</form>
					</VacationModalShell>
				) : null}
			</div>
		</>
	);
}
