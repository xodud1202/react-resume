import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import SnippetGoogleLoginButton from "@/components/snippet/SnippetGoogleLoginButton";
import { requestSnippetClientApi, refreshSnippetSession, type SnippetGoogleLoginResponse } from "@/services/snippetApiService";
import styles from "./SnippetLoginPage.module.css";

// returnUrl을 스니펫 경로로만 제한합니다.
function resolveSafeReturnUrl(value: string | string[] | undefined): string {
	const rawValue = Array.isArray(value) ? value[0] ?? "" : value ?? "";
	const normalizedValue = rawValue.trim();
	if (!normalizedValue.startsWith("/snippet")) {
		return "/snippet";
	}
	return normalizedValue;
}

// 스니펫 로그인 페이지를 렌더링합니다.
export default function SnippetLoginPage() {
	const router = useRouter();
	const [isCheckingSession, setIsCheckingSession] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [message, setMessage] = useState("");
	const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

	// 페이지 진입 시 기존 로그인 세션 복구 여부를 확인합니다.
	useEffect(() => {
		if (!router.isReady) {
			return;
		}

		let isCancelled = false;

		// 복구 가능한 스니펫 세션이 있으면 바로 작업 화면으로 이동합니다.
		const initializePage = async () => {
			const safeReturnUrl = resolveSafeReturnUrl(router.query.returnUrl);
			const result = await refreshSnippetSession();
			if (isCancelled) {
				return;
			}
			if (result.ok && result.data?.authenticated) {
				void router.replace(safeReturnUrl);
				return;
			}
			setIsCheckingSession(false);
		};

		void initializePage();
		return () => {
			isCancelled = true;
		};
	}, [router]);

	// 구글 credential을 백엔드에 전달해 로그인 처리합니다.
	const handleGoogleCredential = async (credential: string, clientId: string) => {
		const safeReturnUrl = resolveSafeReturnUrl(router.query.returnUrl);
		setIsSubmitting(true);
		setMessage("");

		try {
			// 백엔드에서 구글 토큰 검증과 세션 발급을 수행합니다.
			const result = await requestSnippetClientApi<SnippetGoogleLoginResponse>("/api/snippet/auth/google/login", {
				method: "POST",
				body: {
					credential,
					clientId,
				},
			});

			// 비정상 응답은 실패 메시지로 노출합니다.
			if (!result.ok || !result.data || !result.data.loginSuccess) {
				throw new Error(result.message || "구글 로그인 처리에 실패했습니다.");
			}

			// 로그인 성공 시 스니펫 메인 화면으로 이동합니다.
			await router.replace(safeReturnUrl);
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "구글 로그인 처리에 실패했습니다.");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<>
			<Head>
				<title>Snippet Login</title>
				<meta name="description" content="react-resume 전용 개인 스니펫 저장소 로그인" />
			</Head>

			<div className={styles.pageShell}>
				<div className={styles.backgroundGlow} />
				<main className={styles.layout}>
					<section className={styles.heroPanel}>
						<p className={styles.eyebrow}>react-resume private tool</p>
						<h1 className={styles.title}>개인 코드 조각과 메모를 한 화면에서 정리하는 snippet 작업실</h1>
						<p className={styles.description}>
							자주 쓰는 SQL, React 패턴, 배치 쿼리, 운영 메모를 폴더와 태그로 정리하고 빠르게 다시 꺼내 쓸 수 있도록 설계했습니다.
						</p>
						<ul className={styles.featureList}>
							<li>Google 로그인 기반 개인 비공개 저장소</li>
							<li>폴더, 태그, 즐겨찾기, 검색 필터 지원</li>
							<li>CodeMirror 편집기와 복사 이력 기록</li>
						</ul>
						<Link href="/" className={styles.backLink}>
							이력서 화면으로 돌아가기
						</Link>
					</section>

					<section className={styles.cardPanel}>
						<div className={styles.card}>
							<p className={styles.cardLabel}>Snippet Access</p>
							<h2 className={styles.cardTitle}>Google 계정으로 로그인</h2>
							<p className={styles.cardDescription}>로그인하면 개인 스니펫 저장소와 편집 화면에 바로 접근할 수 있습니다.</p>

							{isCheckingSession ? <p className={styles.statusText}>기존 로그인 상태를 확인하고 있습니다.</p> : null}
							{!isCheckingSession ? (
								<SnippetGoogleLoginButton clientId={googleClientId} onCredential={handleGoogleCredential} />
							) : null}
							{isSubmitting ? <p className={styles.statusText}>구글 로그인 정보를 확인하고 있습니다.</p> : null}
							{message.trim() !== "" ? <p className={styles.errorText}>{message}</p> : null}
						</div>
					</section>
				</main>
			</div>
		</>
	);
}
