interface WorkReadonlyHtmlProps {
	// 표시할 본문 값입니다.
	value: string;
	// 비어 있을 때 노출할 문구입니다.
	emptyText: string;
	// 외부 클래스명입니다.
	className?: string;
}

// HTML 마크업 포함 여부를 판단합니다.
function hasHtmlMarkup(value: string): boolean {
	// 태그 문자열이 있으면 HTML 본문으로 간주합니다.
	return /<\s*[a-z][^>]*>/i.test(value);
}

// 읽기 전용 HTML 또는 일반 텍스트 본문을 렌더링합니다.
export default function WorkReadonlyHtml({ value, emptyText, className }: WorkReadonlyHtmlProps) {
	// 값이 비어 있으면 안내 문구를 표시합니다.
	if (!value.trim()) {
		return (
			<div className={className}>
				<div>{emptyText}</div>
			</div>
		);
	}

	// HTML 본문이면 그대로 렌더링하고 일반 텍스트면 줄바꿈을 유지합니다.
	if (hasHtmlMarkup(value)) {
		return <div className={className} dangerouslySetInnerHTML={{ __html: value }} />;
	}

	return (
		<div className={className} style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
			{value}
		</div>
	);
}
