import { useRouter } from "next/router";
import SnippetEditorPage from "@/components/snippet/SnippetEditorPage";

// 스니펫 수정 라우트를 제공합니다.
export default function SnippetEditRoute() {
	const router = useRouter();
	const snippetNo = typeof router.query.snippetNo === "string" ? router.query.snippetNo : null;

	return <SnippetEditorPage snippetNo={snippetNo} />;
}
