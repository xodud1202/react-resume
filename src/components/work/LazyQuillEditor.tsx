import React, { type ComponentProps, type ComponentRef } from "react";
import dynamic from "next/dynamic";

// Quill ref 전달을 지원하는 에디터를 동적으로 로드합니다.
const LazyQuillEditor = dynamic(
	async () => {
		// 브라우저 환경에서만 react-quill 컴포넌트를 불러옵니다.
		const quillModule = await import("react-quill-new");
		const QuillComponent = quillModule.default;
		const ForwardedQuill = React.forwardRef<ComponentRef<typeof QuillComponent>, ComponentProps<typeof QuillComponent>>((props, ref) => (
			<QuillComponent ref={ref} {...props} />
		));
		ForwardedQuill.displayName = "LazyQuillEditor";
		return ForwardedQuill;
	},
	{ ssr: false },
);

export default LazyQuillEditor;
