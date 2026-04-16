import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import FeedbackLayer from "@/components/common/FeedbackLayer";
import useFeedbackLayer from "@/components/common/useFeedbackLayer";
import { fetchSnippetBootstrap, refreshSnippetSession, type SnippetBootstrapResponse } from "@/services/snippetApiService";
import SnippetEditorForm, { SNIPPET_EDITOR_SUCCESS_FLASH_KEY, type SnippetEditorMode } from "./SnippetEditorForm";
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
	const { successMessage, isSuccessVisible, errorMessage, showError, clearError, consumeFlashSuccess } = useFeedbackLayer();
	const mode: SnippetEditorMode = typeof snippetNo === "string" && snippetNo.trim() !== "" ? "edit" : "create";
	const numericSnippetNo = mode === "edit" ? Number(snippetNo) : null;
	const [isInitializing, setIsInitializing] = useState(true);
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
				showError(bootstrapResult.message || "에디터 초기 데이터를 불러오지 못했습니다.");
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
	}, [router, showError, snippetNo]);

	// 신규 저장 후 리다이렉트된 편집 화면에서 1회성 성공 토스트를 한 번만 표시합니다.
	useEffect(() => {
		if (!bootstrap || isInitializing) {
			return;
		}
		consumeFlashSuccess(SNIPPET_EDITOR_SUCCESS_FLASH_KEY);
	}, [bootstrap, consumeFlashSuccess, isInitializing]);

	return (
		<>
			<Head>
				<title>{mode === "edit" ? "Snippet Edit" : "Snippet New"}</title>
				<meta name="description" content="react-resume 전용 스니펫 등록 및 수정 화면" />
			</Head>

			<div className={styles.pageShell}>
				<FeedbackLayer
					successMessage={successMessage}
					isSuccessVisible={isSuccessVisible}
					errorMessage={errorMessage}
					loadingVisible={isInitializing}
					loadingMessage="에디터 화면을 준비하고 있습니다."
					onErrorClose={clearError}
				/>
				{!isInitializing && bootstrap ? <SnippetEditorForm mode={mode} snippetNo={numericSnippetNo} bootstrap={bootstrap} /> : null}
			</div>
		</>
	);
}
