import type { WorkCommonCode, WorkCurrentUser } from "@/components/work/types";

// 매매일지 선택 항목을 정의합니다.
export interface StockSaleOption extends WorkCommonCode {
	// 즐겨찾기 여부입니다.
	favoriteYn?: string;
}

// 매매일지 화면 초기 응답을 정의합니다.
export interface StockSaleBootstrapResponse {
	// 현재 로그인 사용자입니다.
	currentUser: WorkCurrentUser | null;
	// 거래 계좌 목록입니다.
	accountList: StockSaleOption[];
	// 거래 주식 목록입니다.
	stockList: StockSaleOption[];
}

// 매매일지 목록 검색 조건을 정의합니다.
export interface StockSaleListFilter {
	// 시작 매매일입니다.
	startSaleDt?: string;
	// 종료 매매일입니다.
	endSaleDt?: string;
	// 선택된 계좌 코드 목록입니다.
	stockAccountCdList?: string[];
	// 선택된 주식 코드 목록입니다.
	stockNmCdList?: string[];
	// 페이지 번호입니다.
	pageNo?: number;
	// 페이지당 건수입니다.
	pageSize?: number;
}

// 매매일지 거래 등록 요청을 정의합니다.
export interface StockSaleCreateRequest {
	// 매매일자입니다.
	saleDt: string;
	// 거래 계좌 코드입니다.
	stockAccountCd: string;
	// 거래 주식 코드입니다.
	stockNmCd: string;
	// 매매수입니다.
	saleCnt: number;
	// 매매금액입니다.
	saleAmt: number;
	// 손익금액입니다.
	profitAmt: number;
	// 메모입니다.
	memo: string;
}

// 매매일지 거래 등록 응답을 정의합니다.
export interface StockSaleCreateResponse {
	// 처리 메시지입니다.
	message: string;
}

// 종목별 합계 행을 정의합니다.
export interface StockSaleSummaryRow {
	// 주식 코드입니다.
	stockNmCd: string;
	// 주식명입니다.
	stockNm: string;
	// 주식수 합계입니다.
	saleCnt: number;
	// 매매금액 합계입니다.
	saleAmt: number;
	// 매매평단입니다.
	averageSaleAmt: number | null;
	// 손익 합계입니다.
	profitAmt: number;
}

// 매매일지 상세 행을 정의합니다.
export interface StockSaleRow {
	// 매매 이력 번호입니다.
	saleHistSeq: number;
	// 매매일시입니다.
	saleDt: string;
	// 거래 계좌 코드입니다.
	stockAccountCd: string;
	// 거래 계좌명입니다.
	stockAccountNm: string;
	// 거래 주식 코드입니다.
	stockNmCd: string;
	// 거래 주식명입니다.
	stockNm: string;
	// 거래수입니다.
	saleCnt: number;
	// 거래금액입니다.
	saleAmt: number;
	// 손익입니다.
	profitAmt: number;
	// 메모입니다.
	memo: string;
}

// 매매일지 목록 응답을 정의합니다.
export interface StockSaleListResponse {
	// 종목별 합계 목록입니다.
	summaryList: StockSaleSummaryRow[];
	// 상세 목록입니다.
	rowList: StockSaleRow[];
	// 전체 상세 건수입니다.
	totalCount: number;
	// 현재 페이지 번호입니다.
	pageNo: number;
	// 페이지당 건수입니다.
	pageSize: number;
	// 전체 페이지 수입니다.
	totalPageCount: number;
}
