import CodeMirror from "@uiw/react-codemirror";
import { githubLight } from "@uiw/codemirror-theme-github";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { java } from "@codemirror/lang-java";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { sql } from "@codemirror/lang-sql";

interface SnippetCodeEditorProps {
	value: string;
	languageCd: string;
	onChange: (value: string) => void;
}

// 선택한 언어 코드에 맞는 CodeMirror 확장 목록을 반환합니다.
function resolveLanguageExtensions(languageCd: string) {
	switch (languageCd) {
		case "javascript":
			return [javascript()];
		case "typescript":
			return [javascript({ typescript: true })];
		case "java":
			return [java()];
		case "sql":
			return [sql()];
		case "json":
			return [json()];
		case "html":
			return [html()];
		case "css":
			return [css()];
		case "markdown":
			return [markdown()];
		default:
			return [];
	}
}

// 스니펫 본문 편집용 CodeMirror 에디터를 렌더링합니다.
export default function SnippetCodeEditor({ value, languageCd, onChange }: SnippetCodeEditorProps) {
	return (
		<CodeMirror
			value={value}
			height="520px"
			theme={githubLight}
			extensions={resolveLanguageExtensions(languageCd)}
			onChange={(nextValue) => {
				// 에디터 값 변경을 상위 폼 상태로 전달합니다.
				onChange(nextValue);
			}}
			basicSetup={{
				lineNumbers: true,
				foldGutter: true,
				highlightActiveLine: true,
				highlightSelectionMatches: true,
				autocompletion: true,
			}}
		/>
	);
}
