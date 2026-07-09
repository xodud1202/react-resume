// 주식계좌이력 월 컬럼을 정의합니다.
export interface TotalStockHistoryMonth {
	// 월 식별값입니다.
	monthKey: string;
	// 화면 표시 월입니다.
	monthLabel: string;
}

// 주식계좌이력 월별 지표 행을 정의합니다.
export interface TotalStockHistoryValueRow {
	// 행 식별값입니다.
	rowKey: string;
	// 화면 표시 행 이름입니다.
	rowLabel: string;
	// 값 표시 유형입니다.
	valueType: string;
	// 월별 값 Map입니다.
	valueMap: Record<string, number>;
}

// 주식계좌이력 계좌별 행 묶음을 정의합니다.
export interface TotalStockHistoryAccountGroup {
	// 주식 계좌 코드입니다.
	stockAccountCd: string;
	// 주식 계좌명입니다.
	stockAccountNm: string;
	// 계좌별 지표 행 목록입니다.
	rowList: TotalStockHistoryValueRow[];
}

// 주식계좌이력 확인일별 이력 행을 정의합니다.
export interface TotalStockDailyHistoryRow {
	// 확인일입니다.
	checkDt: string;
	// 해당 확인일까지의 계좌 총원금액입니다.
	principalAmt: number;
	// 확인 평가금입니다.
	checkAmt: number;
	// 원금대비 손익금입니다.
	profitAmt: number;
	// 원금대비 손익율입니다.
	profitRate: number;
	// 이전대비 손익금입니다.
	previousCompareProfitAmt: number;
	// 이전대비 손익율입니다.
	previousCompareProfitRate: number;
	// 확인일의 계좌별 확인 평가금 Map입니다.
	checkAccountAmountMap: Record<string, number>;
}

// 주식계좌 입출금 이력 행을 정의합니다.
export interface TotalStockCashHistoryRow {
	// 입출금 이력 식별자입니다.
	cashHistSeq: number;
	// 입출금일입니다.
	cashDt: string;
	// 주식 계좌 코드입니다.
	stockAccountCd: string;
	// 주식 계좌명입니다.
	stockAccountNm: string;
	// 입출금구분 코드입니다.
	cashInOutCd: string;
	// 입출금구분 이름입니다.
	cashInOutNm: string;
	// 입출금액입니다.
	cashAmt: number;
}

// 주식계좌이력 조회 응답을 정의합니다.
export interface TotalStockHistoryResponse {
	// 월별 정보 컬럼 목록입니다.
	monthList: TotalStockHistoryMonth[];
	// 전체 요약 행 목록입니다.
	summaryRowList: TotalStockHistoryValueRow[];
	// 계좌별 월별 행 묶음 목록입니다.
	accountGroupList: TotalStockHistoryAccountGroup[];
	// 확인일별 이력 목록입니다.
	historyRowList: TotalStockDailyHistoryRow[];
	// 확인일별 전체 건수입니다.
	historyTotalCount: number;
	// 확인일별 페이지 크기입니다.
	historyPageSize: number;
	// 확인일별 더보기 존재 여부입니다.
	historyHasMore: boolean;
	// 입출금 이력 목록입니다.
	cashHistoryRowList: TotalStockCashHistoryRow[];
	// 입출금 이력 페이지 크기입니다.
	cashHistoryPageSize: number;
	// 입출금 이력 더보기 존재 여부입니다.
	cashHistoryHasMore: boolean;
}

// 주식계좌이력 조회 조건을 정의합니다.
export interface TotalStockHistoryFilter {
	// 선택된 계좌 코드 목록입니다.
	stockAccountCdList?: string[];
	// 확인일별 이력 시작 위치입니다.
	historyOffset?: number;
	// 입출금 이력 시작 위치입니다.
	cashHistoryOffset?: number;
}

// 계좌 확인 평가금 저장 요청 행을 정의합니다.
export interface TotalStockCheckAmountSaveRequest {
	// 확인일입니다.
	checkDt: string;
	// 주식 계좌 코드입니다.
	stockAccountCd: string;
	// 확인 평가금입니다.
	stockTotalAmt: number;
}

// 계좌 입출금 등록 요청을 정의합니다.
export interface TotalStockCashHistoryCreateRequest {
	// 입출금일입니다.
	cashDt: string;
	// 주식 계좌 코드입니다.
	stockAccountCd: string;
	// 입출금구분 코드입니다.
	cashInOutCd: string;
	// 입출금액입니다.
	cashAmt: number;
}

// 계좌이력 저장 응답을 정의합니다.
export interface TotalStockSaveResponse {
	// 처리 메시지입니다.
	message: string;
}
