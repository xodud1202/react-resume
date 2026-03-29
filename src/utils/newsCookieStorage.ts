import Cookies from "universal-cookie";

const cookies = new Cookies();

/** 언론사 순서 쿠키 키입니다. */
const COOKIE_KEY_PRESS_ORDER = "news_press_order";
/** 마지막 선택 언론사 쿠키 키입니다. */
const COOKIE_KEY_SELECTED_PRESS = "news_selected_press";
/** 쿠키 유효기간 1년 (초 단위)입니다. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * 언론사 순서 목록을 쿠키에서 읽어 반환한다.
 * 값이 없거나 파싱 실패 시 빈 배열을 반환한다.
 */
export function getPressOrderFromCookie(): string[] {
  try {
    const value = cookies.get<unknown>(COOKIE_KEY_PRESS_ORDER);
    if (!value) {
      return [];
    }
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

/**
 * 언론사 순서 목록을 쿠키에 저장한다.
 */
export function setPressOrderToCookie(pressIds: string[]): void {
  if (!Array.isArray(pressIds)) {
    return;
  }
  cookies.set(COOKIE_KEY_PRESS_ORDER, JSON.stringify(pressIds), {
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

/**
 * 마지막으로 선택한 언론사 ID를 쿠키에서 읽어 반환한다.
 * universal-cookie v8의 get()은 내부적으로 이미 JSON.parse를 시도하므로
 * 추가 파싱 없이 반환된 값을 그대로 사용한다.
 * 값이 없으면 빈 문자열을 반환한다.
 */
export function getSelectedPressFromCookie(): string {
  try {
    const value = cookies.get<unknown>(COOKIE_KEY_SELECTED_PRESS);
    // universal-cookie v8 get()이 내부에서 JSON.parse('"jtbc"') → "jtbc" 로 이미 파싱함.
    // 여기서 다시 JSON.parse("jtbc") 를 시도하면 오류가 발생하므로 value 를 직접 사용한다.
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    return "";
  } catch {
    return "";
  }
}

/**
 * 마지막으로 선택한 언론사 ID를 쿠키에 저장한다.
 * 순서 쿠키와 동일하게 JSON.stringify 로 직렬화해서 저장한다.
 */
export function setSelectedPressToCookie(pressId: string): void {
  if (typeof pressId !== "string" || !pressId.trim()) {
    return;
  }
  cookies.set(COOKIE_KEY_SELECTED_PRESS, JSON.stringify(pressId.trim()), {
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}
