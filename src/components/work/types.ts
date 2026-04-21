// 업무관리 로그인 복구 응답을 정의합니다.
export interface WorkSessionRefreshResponse {
	// 인증 여부입니다.
	authenticated: boolean;
	// 로그인 사용자번호입니다.
	workUserNo: number | null;
	// 로그인 아이디입니다.
	loginId: string;
	// 사용자명입니다.
	userNm: string;
}

// 업무관리 로그인 요청을 정의합니다.
export interface WorkLoginRequest {
	// 로그인 아이디입니다.
	loginId: string;
	// 비밀번호입니다.
	pwd: string;
}

// 업무관리 현재 사용자 정보를 정의합니다.
export interface WorkCurrentUser {
	// 사용자 번호입니다.
	usrNo: number;
	// 로그인 아이디입니다.
	loginId: string;
	// 사용자명입니다.
	userNm: string;
	// 사용자 등급 코드입니다.
	usrGradeCd: string;
	// 사용자 상태 코드입니다.
	usrStatCd: string;
}

// 공통코드 항목을 정의합니다.
export interface WorkCommonCode {
	// 그룹 코드입니다.
	grpCd?: string;
	// 코드입니다.
	cd: string;
	// 코드명입니다.
	cdNm: string;
	// 표시 순서입니다.
	dispOrd?: number | null;
}

// 회사 선택 항목을 정의합니다.
export interface WorkCompanyOption {
	// 회사 번호입니다.
	workCompanySeq: number;
	// 회사명입니다.
	workCompanyNm: string;
	// 플랫폼명입니다.
	workPlatformNm: string;
	// 표시 순서입니다.
	dispOrd: number;
}

// 프로젝트 선택 항목을 정의합니다.
export interface WorkProjectOption {
	// 프로젝트 번호입니다.
	workCompanyProjectSeq: number;
	// 회사 번호입니다.
	workCompanySeq: number;
	// 프로젝트명입니다.
	workCompanyProjectNm: string;
	// 표시 순서입니다.
	dispOrd: number;
}

// 업무관리 bootstrap 응답을 정의합니다.
export interface WorkBootstrapResponse {
	// 현재 로그인 사용자 정보입니다.
	currentUser: WorkCurrentUser | null;
	// 회사 목록입니다.
	companyList: WorkCompanyOption[];
	// 초기 프로젝트 목록입니다.
	projectList: WorkProjectOption[];
	// 업무 상태 코드 목록입니다.
	workStatList: WorkCommonCode[];
	// 업무 우선순위 코드 목록입니다.
	workPriorList: WorkCommonCode[];
}

// 업무 목록 행을 정의합니다.
export interface WorkListRow {
	// 업무 시퀀스입니다.
	workSeq: number;
	// 회사 번호입니다.
	workCompanySeq: number;
	// 프로젝트 번호입니다.
	workCompanyProjectSeq: number;
	// 업무 상태 코드입니다.
	workStatCd: string;
	// 업무 키입니다.
	workKey: string;
	// 제목입니다.
	title: string;
	// 댓글 수입니다.
	replyCount: number;
	// 업무 생성 일시입니다.
	workCreateDt: string;
	// 업무 시작 일시입니다.
	workStartDt: string;
	// 업무 종료 일시입니다.
	workEndDt: string;
	// 공수입니다.
	workTime: number | null;
	// 우선순위 코드입니다.
	workPriorCd: string;
	// 우선순위명입니다.
	workPriorNm: string;
	// IT 담당자입니다.
	itManager: string;
	// 업무 담당자입니다.
	coManager: string;
	// 등록 일시입니다.
	regDt: string;
	// 수정 일시입니다.
	udtDt: string;
}

// 상태별 업무 섹션을 정의합니다.
export interface WorkStatusSection {
	// 업무 상태 코드입니다.
	workStatCd: string;
	// 해당 상태 업무 목록입니다.
	list: WorkListRow[];
	// 해당 상태의 전체 업무 건수입니다.
	totalCount: number;
	// 추가 조회 가능 여부입니다.
	hasMore: boolean;
}

// 상태별 목록 응답을 정의합니다.
export interface WorkListResponse {
	// 상태별 섹션 목록입니다.
	statusSectionList: WorkStatusSection[];
}

// 상태별 추가 조회 응답을 정의합니다.
export interface WorkStatusSectionPageResponse {
	// 업무 상태 코드입니다.
	workStatCd: string;
	// 이번 요청으로 조회한 업무 목록입니다.
	list: WorkListRow[];
	// 해당 상태의 전체 업무 건수입니다.
	totalCount: number;
	// 현재 오프셋입니다.
	offset: number;
	// 현재 요청 제한 건수입니다.
	limit: number;
	// 추가 조회 가능 여부입니다.
	hasMore: boolean;
}

// 업무 상세 정보를 정의합니다.
export interface WorkDetail extends WorkListRow {
	// 회사명입니다.
	workCompanyNm: string;
	// 프로젝트명입니다.
	workCompanyProjectNm: string;
	// 본문입니다.
	content: string;
}

// 업무 첨부파일 정보를 정의합니다.
export interface WorkFile {
	// 첨부파일 번호입니다.
	workJobFileSeq: number;
	// 업무 번호입니다.
	workSeq: number;
	// 첨부파일명입니다.
	workJobFileNm: string;
	// 첨부파일 URL입니다.
	workJobFileUrl: string;
	// 등록 일시입니다.
	regDt: string;
	// 수정 일시입니다.
	udtDt: string;
}

// 댓글 첨부파일 정보를 정의합니다.
export interface WorkReplyFile {
	// 댓글 첨부파일 번호입니다.
	replyFileSeq: number;
	// 댓글 번호입니다.
	replySeq: number;
	// 업무 번호입니다.
	workSeq: number;
	// 첨부파일명입니다.
	replyFileNm: string;
	// 첨부파일 URL입니다.
	replyFileUrl: string;
	// 첨부파일 크기입니다.
	replyFileSize: number | null;
	// 등록 일시입니다.
	regDt: string;
	// 수정 일시입니다.
	udtDt: string;
}

// 댓글 정보를 정의합니다.
export interface WorkReply {
	// 댓글 번호입니다.
	replySeq: number;
	// 업무 번호입니다.
	workSeq: number;
	// 댓글 본문입니다.
	replyComment: string;
	// 등록자 번호입니다.
	regNo: number;
	// 등록 일시입니다.
	regDt: string;
	// 수정 일시입니다.
	udtDt: string;
	// 댓글 첨부 목록입니다.
	replyFileList: WorkReplyFile[];
}

// 업무 상세 응답을 정의합니다.
export interface WorkDetailResponse {
	// 업무 상세입니다.
	detail: WorkDetail | null;
	// 업무 첨부 목록입니다.
	fileList: WorkFile[];
	// 댓글 목록입니다.
	replyList: WorkReply[];
}

// 업무 목록 검색 필터를 정의합니다.
export interface WorkListFilter {
	// 회사 번호입니다.
	workCompanySeq?: number | null;
	// 프로젝트 번호입니다.
	workCompanyProjectSeq?: number | null;
	// 검색어입니다.
	title?: string;
	// 본문 포함 검색 여부입니다.
	includeBodyYn?: string;
	// 선택 상태 코드 목록입니다.
	workStatCdList?: string[];
	// 상태 섹션당 최초 조회 건수입니다.
	sectionSize?: number | null;
}

// 업무 수기 등록 요청을 정의합니다.
export interface WorkManualCreateRequest {
	// 회사 번호입니다.
	workCompanySeq: number;
	// 프로젝트 번호입니다.
	workCompanyProjectSeq: number;
	// 제목입니다.
	title: string;
	// 본문입니다.
	content: string;
	// 업무 담당자입니다.
	coManager: string;
	// 우선순위 코드입니다.
	workPriorCd: string;
}

// 업무 수기 등록 응답을 정의합니다.
export interface WorkManualCreateResponse {
	// 처리 메시지입니다.
	message: string;
	// 업무 번호입니다.
	workSeq: number;
	// 업무 키입니다.
	workKey: string;
}

// SR 가져오기 모달 입력 상태를 정의합니다.
export interface WorkImportFormState {
	// 선택된 회사 번호 문자열입니다.
	workCompanySeq: string;
	// 선택된 프로젝트 번호 문자열입니다.
	workCompanyProjectSeq: string;
	// 입력한 업무 키입니다.
	workKey: string;
}

// SR 가져오기 요청을 정의합니다.
export interface WorkImportRequest {
	// 회사 번호입니다.
	workCompanySeq: number;
	// 프로젝트 번호입니다.
	workCompanyProjectSeq: number;
	// 업무 키입니다.
	workKey: string;
}

// SR 가져오기 응답을 정의합니다.
export interface WorkImportResponse {
	// 처리 메시지입니다.
	message: string;
	// 업무 번호입니다.
	workSeq: number;
	// 업무 키입니다.
	workKey: string;
}

// 업무 상세 저장 요청을 정의합니다.
export interface WorkDetailUpdateRequest {
	// 업무 번호입니다.
	workSeq: number;
	// 제목입니다.
	title: string;
	// 업무 상태 코드입니다.
	workStatCd: string;
	// IT 담당자입니다.
	itManager: string;
	// 업무 담당자입니다.
	coManager: string;
	// 업무 생성 일시입니다.
	workCreateDt: string;
	// 시작 일자입니다.
	workStartDt: string;
	// 종료 일자입니다.
	workEndDt: string;
	// 공수입니다.
	workTime: number | null;
	// 본문입니다.
	content: string;
	// 삭제할 업무 첨부파일 번호 목록입니다.
	deleteWorkJobFileSeqList: number[];
}

// 업무 첨부파일 삭제 요청을 정의합니다.
export interface WorkFileDeleteRequest {
	// 업무 번호입니다.
	workSeq: number;
	// 첨부파일 번호입니다.
	workJobFileSeq: number;
}

// 댓글 저장 요청을 정의합니다.
export interface WorkReplySaveRequest {
	// 업무 번호입니다.
	workSeq: number;
	// 댓글 본문입니다.
	replyComment: string;
}

// 댓글 수정 요청을 정의합니다.
export interface WorkReplyUpdateRequest {
	// 댓글 번호입니다.
	replySeq: number;
	// 업무 번호입니다.
	workSeq: number;
	// 댓글 본문입니다.
	replyComment: string;
	// 삭제할 댓글 첨부파일 번호 목록입니다.
	deleteReplyFileSeqList: number[];
}

// 댓글 컴포저 저장 payload를 정의합니다.
export interface WorkReplyComposerSubmitPayload {
	// 댓글 본문 HTML입니다.
	replyComment: string;
	// 새로 추가한 첨부파일 목록입니다.
	newFiles: File[];
	// 삭제 대상으로 표시한 기존 댓글 첨부파일 번호 목록입니다.
	deleteReplyFileSeqList: number[];
}

// 댓글 삭제 요청을 정의합니다.
export interface WorkReplyDeleteRequest {
	// 댓글 번호입니다.
	replySeq: number;
	// 업무 번호입니다.
	workSeq: number;
}

// 업무 첨부파일 다운로드 결과를 정의합니다.
export interface WorkFileDownloadData {
	// 파일명입니다.
	fileName: string;
	// Blob 데이터입니다.
	blob: Blob;
}

// 댓글 첨부파일 다운로드 결과는 업무 첨부 다운로드 형식을 재사용합니다.
export type WorkReplyFileDownloadData = WorkFileDownloadData;
