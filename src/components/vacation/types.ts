import type { WorkCommonCode, WorkCurrentUser } from "@/components/work/types";

// 휴가관리 회사 선택 항목을 정의합니다.
export interface VacationCompanyOption {
	// 회사 번호입니다.
	workCompanySeq: number;
	// 회사명입니다.
	workCompanyNm: string;
	// 플랫폼명입니다.
	workPlatformNm: string;
	// 회사별 사용 가능 연차입니다.
	vacationLimitCnt: number;
	// 표시 순서입니다.
	dispOrd: number;
}

// 휴가자 선택 항목을 정의합니다.
export interface VacationPersonOption {
	// 휴가자 번호입니다.
	personSeq: number;
	// 휴가자명입니다.
	personNm: string;
	// 즐겨찾기 여부입니다.
	favoriteYn: string;
	// 표시 순서입니다.
	dispOrd: number;
}

// 휴가관리 초기 응답을 정의합니다.
export interface VacationBootstrapResponse {
	// 현재 로그인 사용자입니다.
	currentUser: WorkCurrentUser | null;
	// 휴가 사용 가능 회사 목록입니다.
	companyList: VacationCompanyOption[];
	// 휴가자 목록입니다.
	personList: VacationPersonOption[];
	// 휴가 구분 코드 목록입니다.
	vacationCodeList: WorkCommonCode[];
}

// 휴가관리 목록 필터를 정의합니다.
export interface VacationListFilter {
	// 휴가자 번호입니다.
	personSeq?: number | null;
	// 회사 번호입니다.
	workCompanySeq?: number | null;
	// 휴가년도입니다.
	vacationYear?: number | null;
	// 회사 기본 선택 요청 여부입니다.
	defaultCompanyYn?: string | null;
}

// 연차 사용 요약 행을 정의합니다.
export interface VacationSummaryRow {
	// 휴가자 번호입니다.
	personSeq: number;
	// 휴가자명입니다.
	personNm: string;
	// 회사 번호입니다.
	workCompanySeq: number;
	// 회사명입니다.
	workCompanyNm: string;
	// 전체 연차입니다.
	vacationLimitCnt: number;
	// 소진 연차입니다.
	usedVacationCnt: number;
	// 연차 사용일입니다.
	fullVacationCnt: number;
	// 오전반차 사용일입니다.
	morningHalfCnt: number;
	// 오후반차 사용일입니다.
	afternoonHalfCnt: number;
	// 잔여 휴가입니다.
	remainingVacationCnt: number;
}

// 휴가 사용 목록 행을 정의합니다.
export interface VacationListRow {
	// 휴가 번호입니다.
	vacationSeq: number;
	// 휴가자 번호입니다.
	personSeq: number;
	// 휴가자명입니다.
	personNm: string;
	// 회사 번호입니다.
	workCompanySeq: number;
	// 회사명입니다.
	workCompanyNm: string;
	// 휴가 구분 코드입니다.
	vacationCd: string;
	// 휴가 구분명입니다.
	vacationNm: string;
	// 시작일입니다.
	startDt: string;
	// 종료일입니다.
	endDt: string;
	// 사용일입니다.
	useDayCnt: number;
	// 휴가 사유입니다.
	vacationMemo: string;
	// 등록 일시입니다.
	regDt: string;
	// 수정 일시입니다.
	udtDt: string;
}

// 휴가관리 목록 응답을 정의합니다.
export interface VacationListResponse {
	// 현재 선택된 회사 번호입니다.
	selectedWorkCompanySeq: number | null;
	// 회사 필터에 노출할 휴가 등록 회사 목록입니다.
	companyList: VacationCompanyOption[];
	// 선택 가능한 휴가년도 목록입니다.
	yearList: number[];
	// 현재 선택된 휴가년도입니다.
	selectedYear: number | null;
	// 연차 사용 요약 목록입니다.
	summaryList: VacationSummaryRow[];
	// 휴가 사용 목록입니다.
	vacationList: VacationListRow[];
}

// 휴가 등록 요청을 정의합니다.
export interface VacationCreateRequest {
	// 휴가자 번호입니다.
	personSeq: number;
	// 회사 번호입니다.
	workCompanySeq: number;
	// 휴가 구분 코드입니다.
	vacationCd: string;
	// 시작일입니다.
	startDt: string;
	// 종료일입니다.
	endDt: string;
	// 휴가 사유입니다.
	vacationMemo: string;
}

// 휴가 등록 응답을 정의합니다.
export interface VacationCreateResponse {
	// 처리 메시지입니다.
	message: string;
	// 등록된 휴가 번호입니다.
	vacationSeq: number;
}
