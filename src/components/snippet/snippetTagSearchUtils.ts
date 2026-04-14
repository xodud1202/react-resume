import type { SnippetTag } from "@/services/snippetApiService";

// 태그 검색 비교용 키를 생성합니다.
export function normalizeTagSearchKey(value: string): string {
	const normalizedValue = value.trim().replace(/^#+/, "").trim();
	return normalizedValue === "" ? "" : normalizedValue.toLowerCase();
}

// 태그 생성 요청에 사용할 표시명을 정규화합니다.
export function normalizeTagCreateName(value: string): string | null {
	const normalizedValue = value.trim().replace(/^#+/, "").trim();
	return normalizedValue === "" ? null : normalizedValue;
}

// 입력값과 정확히 일치하는 기존 태그를 찾습니다.
export function findMatchedTag(tagList: SnippetTag[], inputValue: string): SnippetTag | null {
	const normalizedSearchKey = normalizeTagSearchKey(inputValue);
	if (normalizedSearchKey === "") {
		return null;
	}
	return tagList.find((tag) => normalizeTagSearchKey(tag.tagNm) === normalizedSearchKey) ?? null;
}

// 선택된 태그를 제외한 추천 후보 목록을 계산합니다.
export function filterTagSuggestionList(tagList: SnippetTag[], inputValue: string, excludedTagNoList: number[] = []): SnippetTag[] {
	const normalizedSearchKey = normalizeTagSearchKey(inputValue);
	if (normalizedSearchKey === "") {
		return [];
	}

	return tagList.filter((tag) => {
		if (excludedTagNoList.includes(tag.tagNo)) {
			return false;
		}
		return normalizeTagSearchKey(tag.tagNm).includes(normalizedSearchKey);
	});
}

// 새로 생성된 태그를 기존 태그 목록에 합칩니다.
export function mergeAvailableTagList(tagList: SnippetTag[], createdTag: SnippetTag): SnippetTag[] {
	const mergedTagMap = new Map<number, SnippetTag>();
	tagList.forEach((tag) => {
		mergedTagMap.set(tag.tagNo, tag);
	});
	mergedTagMap.set(createdTag.tagNo, createdTag);
	return Array.from(mergedTagMap.values()).sort((leftTag, rightTag) => {
		if (leftTag.sortSeq !== rightTag.sortSeq) {
			return leftTag.sortSeq - rightTag.sortSeq;
		}
		return leftTag.tagNo - rightTag.tagNo;
	});
}
