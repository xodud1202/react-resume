import Cookies from "universal-cookie";

const cookies = new Cookies();

const COOKIE_KEY = "news_press_order";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1년 (초 단위)

export function getPressOrderFromCookie(): string[] {
  try {
    const value = cookies.get<unknown>(COOKIE_KEY);
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

export function setPressOrderToCookie(pressIds: string[]): void {
  if (!Array.isArray(pressIds)) {
    return;
  }
  cookies.set(COOKIE_KEY, JSON.stringify(pressIds), {
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}
