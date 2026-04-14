import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState, type FormEvent } from "react";
import { loginWork, refreshWorkSession } from "@/services/workApiService";
import styles from "./WorkLoginPage.module.css";

// returnUrl을 업무관리 경로로만 제한합니다.
function resolveSafeReturnUrl(value: string | string[] | undefined): string {
	const rawValue = Array.isArray(value) ? value[0] ?? "" : value ?? "";
	const normalizedValue = rawValue.trim();
	if (!normalizedValue.startsWith("/work")) {
		return "/work";
	}
	return normalizedValue;
}

// 업무관리 로그인 페이지를 렌더링합니다.
export default function WorkLoginPage() {
	const router = useRouter();
	const [isCheckingSession, setIsCheckingSession] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [message, setMessage] = useState("");
	const [loginId, setLoginId] = useState("");
	const [pwd, setPwd] = useState("");

	// 페이지 진입 시 복구 가능한 업무관리 세션이 있는지 확인합니다.
	useEffect(() => {
		if (!router.isReady) {
			return;
		}

		let isCancelled = false;

		// 로그인된 세션이 있으면 바로 업무관리 화면으로 이동합니다.
		const initializePage = async () => {
			const safeReturnUrl = resolveSafeReturnUrl(router.query.returnUrl);
			const result = await refreshWorkSession();
			if (isCancelled) {
				return;
			}

			if (result.ok && result.data?.authenticated) {
				await router.replace(safeReturnUrl);
				return;
			}

			setIsCheckingSession(false);
		};

		void initializePage();
		return () => {
			isCancelled = true;
		};
	}, [router]);

	// 로그인 폼을 제출해 업무관리 세션을 생성합니다.
	const handleSubmitLogin = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		if (loginId.trim() === "" || pwd.trim() === "") {
			setMessage("아이디와 비밀번호를 입력해주세요.");
			return;
		}

		setIsSubmitting(true);
		setMessage("");

		try {
			// 아이디/비밀번호 인증을 수행한 뒤 성공 시 업무관리 화면으로 이동합니다.
			const result = await loginWork({
				loginId: loginId.trim(),
				pwd,
			});
			if (!result.ok || !result.data?.authenticated) {
				setMessage(result.message || "업무관리 로그인에 실패했습니다.");
				return;
			}

			await router.replace(resolveSafeReturnUrl(router.query.returnUrl));
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<>
			<Head>
				<title>업무관리 로그인</title>
				<meta name="description" content="react-resume 업무관리 로그인" />
			</Head>

			<div className={styles.pageShell}>
				<main className={styles.layout}>
					<section className={styles.heroPanel}>
						<p className={styles.eyebrow}>react-resume work</p>
						<h1 className={styles.title}>회사 업무를 빠르게 확인하고 바로 처리하는 work workspace</h1>
						<p className={styles.description}>
							회사, 프로젝트, 상태 기준으로 업무를 묶어 보고, 상세 패널에서 즉시 수정과 댓글 등록까지 이어서 처리할 수 있도록 준비했습니다.
						</p>
						<ul className={styles.featureList}>
							<li>회사/프로젝트 선택과 상태별 업무 목록</li>
							<li>우측 상세 패널 즉시 수정과 첨부 관리</li>
							<li>수기등록, SR가져오기, 댓글 흐름 통합</li>
						</ul>
						<Link href="/" className={styles.backLink}>
							메뉴로 돌아가기
						</Link>
					</section>

					<section className={styles.cardPanel}>
						<div className={styles.card}>
							<p className={styles.cardLabel}>Work Login</p>
							<h2 className={styles.cardTitle}>사내 계정으로 로그인</h2>
							<p className={styles.cardDescription}>기존 USER_BASE 계정으로 로그인하면 업무관리 작업 화면에 바로 접근할 수 있습니다.</p>

							{isCheckingSession ? <p className={styles.statusText}>기존 로그인 상태를 확인하고 있습니다.</p> : null}

							{!isCheckingSession ? (
								<form className={styles.form} onSubmit={handleSubmitLogin}>
									<label className={styles.fieldLabel}>
										아이디
										<input
											type="text"
											value={loginId}
											onChange={(event) => setLoginId(event.target.value)}
											className={styles.fieldInput}
											autoComplete="username"
										/>
									</label>
									<label className={styles.fieldLabel}>
										비밀번호
										<input
											type="password"
											value={pwd}
											onChange={(event) => setPwd(event.target.value)}
											className={styles.fieldInput}
											autoComplete="current-password"
										/>
									</label>
									<button type="submit" className={styles.submitButton} disabled={isSubmitting}>
										{isSubmitting ? "로그인 중..." : "로그인"}
									</button>
								</form>
							) : null}

							{message.trim() !== "" ? <p className={styles.errorText}>{message}</p> : null}
						</div>
					</section>
				</main>
			</div>
		</>
	);
}
