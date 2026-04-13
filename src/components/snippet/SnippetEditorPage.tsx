import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { fetchSnippetBootstrap, refreshSnippetSession, type SnippetBootstrapResponse } from "@/services/snippetApiService";
import SnippetEditorForm, { type SnippetEditorMode } from "./SnippetEditorForm";
import styles from "./SnippetEditorPage.module.css";

interface SnippetEditorPageProps {
	snippetNo?: string | null;
}

// 로그인 리다이렉트용 returnUrl을 생성합니다.
function resolveEditorReturnUrl(snippetNo?: string | null): string {
	if (typeof snippetNo === "string" && snippetNo.trim() !== "") {
		return `/snippet/edit/${encodeURIComponent(snippetNo.trim())}`;
	}
	return "/snippet/edit/new";
}

// fallback 전체 페이지용 스니펫 에디터를 렌더링합니다.
export default function SnippetEditorPage({ snippetNo }: SnippetEditorPageProps) {
	const router = useRouter();
	const mode: SnippetEditorMode = typeof snippetNo === "string" && snippetNo.trim() !== "" ? "edit" : "create";
	const numericSnippetNo = mode === "edit" ? Number(snippetNo) : null;
	const [isInitializing, setIsInitializing] = useState(true);
	const [message, setMessage] = useState("");
	const [bootstrap, setBootstrap] = useState<SnippetBootstrapResponse | null>(null);

	// 페이지 진입 시 세션 복구와 bootstrap 데이터를 초기화합니다.
	useEffect(() => {
		let isCancelled = false;

		// 로그인 세션을 확인한 뒤 편집용 bootstrap을 조회합니다.
		const initializePage = async () => {
			const sessionResult = await refreshSnippetSession();
			if (isCancelled) {
				return;
			}

			if (!sessionResult.ok || !sessionResult.data?.authenticated) {
				await router.replace(`/snippet/login?returnUrl=${encodeURIComponent(resolveEditorReturnUrl(snippetNo))}`);
				return;
			}

			const bootstrapResult = await fetchSnippetBootstrap();
			if (isCancelled) {
				return;
			}

			if (!bootstrapResult.ok || !bootstrapResult.data) {
				setMessage(bootstrapResult.message || "에디터 초기 데이터를 불러오지 못했습니다.");
				setIsInitializing(false);
				return;
			}

			setBootstrap(bootstrapResult.data);
			setIsInitializing(false);
		};

		void initializePage();
		return () => {
			isCancelled = true;
		};
	}, [router, snippetNo]);

	return (
		<>
			<Head>
				<title>{mode === "edit" ? "Snippet Edit" : "Snippet New"}</title>
				<meta name="description" content="react-resume 전용 스니펫 등록 및 수정 화면" />
			</Head>

			<div className={styles.pageShell}>
				{message.trim() !== "" ? <p className={styles.messageBar}>{message}</p> : null}
				{isInitializing ? <p className={styles.loadingText}>에디터 화면을 준비하고 있습니다.</p> : null}
				{!isInitializing && bootstrap ? <SnippetEditorForm mode={mode} snippetNo={numericSnippetNo} bootstrap={bootstrap} /> : null}
			</div>
		</>
	);
}
