const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** 날짜 선택 버튼과 화면 제목에서 함께 사용하는 날짜 정보입니다. */
export interface NewsSummaryDay {
  date: string;
  weekday: string;
  label: string;
  fullLabel: string;
}

/** 오늘을 마지막에 두고 이전 6일부터 최근 일주일의 날짜를 구성합니다. */
export function getNewsSummaryDays(today: string): NewsSummaryDay[] {
  const anchor = new Date(`${today.slice(0, 4)}-${today.slice(4, 6)}-${today.slice(6, 8)}T00:00:00Z`);
  // UTC 날짜 계산으로 월말·연말·일광절약시간 경계에서도 일주일 순서를 유지합니다.
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(anchor);
    date.setUTCDate(anchor.getUTCDate() - 6 + index);
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    const weekday = WEEKDAYS[date.getUTCDay()];
    return {
      date: date.toISOString().slice(0, 10).replaceAll("-", ""),
      weekday,
      label: `${month}.${day}`,
      fullLabel: `${month}월 ${day}일 ${weekday}요일`,
    };
  });
}
