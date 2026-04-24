import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import styles from "./SnippetGoogleLoginButton.module.css";

interface SnippetGoogleLoginButtonProps {
	clientId: string;
	onCredential: (credential: string, clientId: string) => void | Promise<void>;
}

interface GoogleCredentialResponse {
	credential?: string;
	select_by?: string;
}

interface GoogleIdConfiguration {
	client_id: string;
	callback: (response: GoogleCredentialResponse) => void;
	ux_mode?: "popup" | "redirect";
}

interface GoogleIdButtonConfiguration {
	type?: "standard" | "icon";
	theme?: "outline" | "filled_blue" | "filled_black";
	size?: "large" | "medium" | "small";
	text?: "signin_with" | "signup_with" | "continue_with" | "signin";
	shape?: "rectangular" | "pill" | "circle" | "square";
	width?: number;
}

interface GoogleAccountsIdApi {
	initialize: (config: GoogleIdConfiguration) => void;
	renderButton: (parent: HTMLElement, options: GoogleIdButtonConfiguration) => void;
}

interface GoogleWindow {
	accounts: {
		id: GoogleAccountsIdApi;
	};
}

declare global {
	interface Window {
		google?: GoogleWindow;
	}
}

let initializedGoogleClientId = "";
let activeGoogleCredentialHandler: ((response: GoogleCredentialResponse) => void) | null = null;

// 구글 SDK의 전역 credential 콜백을 현재 활성 로그인 컴포넌트로 위임합니다.
function handleGlobalGoogleCredentialResponse(response: GoogleCredentialResponse): void {
	activeGoogleCredentialHandler?.(response);
}

// 구글 로그인 SDK는 페이지당 한 번만 초기화해 중복 initialize 경고를 방지합니다.
function initializeGoogleIdentityClient(clientId: string): void {
	if (initializedGoogleClientId === clientId) {
		return;
	}

	window.google?.accounts?.id.initialize({
		client_id: clientId,
		callback: handleGlobalGoogleCredentialResponse,
		ux_mode: "popup",
	});
	initializedGoogleClientId = clientId;
}

// 스니펫 전용 구글 로그인 버튼을 렌더링합니다.
export default function SnippetGoogleLoginButton({ clientId, onCredential }: SnippetGoogleLoginButtonProps) {
	const buttonContainerRef = useRef<HTMLDivElement | null>(null);
	const onCredentialRef = useRef(onCredential);
	const [isGoogleScriptLoaded, setIsGoogleScriptLoaded] = useState<boolean>(() => {
		// 초기 렌더링 시 이미 로드된 구글 SDK를 감지합니다.
		return typeof window !== "undefined" && Boolean(window.google?.accounts?.id);
	});
	const [runtimeErrorMessage, setRuntimeErrorMessage] = useState("");

	// 현재 클라이언트 설정 상태를 계산합니다.
	const isClientIdMissing = clientId.trim() === "";
	const isError = isClientIdMissing || runtimeErrorMessage.trim() !== "";
	const message = isClientIdMissing
		? "NEXT_PUBLIC_GOOGLE_CLIENT_ID 값을 추가해주세요."
		: runtimeErrorMessage.trim() !== ""
			? runtimeErrorMessage
			: "";

	// 부모 컴포넌트가 다시 렌더링되어도 구글 SDK 콜백은 최신 핸들러를 참조합니다.
	useEffect(() => {
		onCredentialRef.current = onCredential;
	}, [onCredential]);

	// 스크립트와 clientId가 준비되면 구글 로그인 버튼을 렌더링합니다.
	useEffect(() => {
		// 필수 설정값이 없으면 버튼 렌더링을 중단합니다.
		if (isClientIdMissing) {
			return;
		}

		// 스크립트나 버튼 컨테이너가 준비되지 않았으면 렌더링을 보류합니다.
		if (!isGoogleScriptLoaded || !buttonContainerRef.current || !window.google?.accounts?.id) {
			return;
		}

		// 구글 credential 응답을 상위 로그인 흐름으로 전달합니다.
		const handleCredentialResponse = (response: GoogleCredentialResponse) => {
			const credential = typeof response.credential === "string" ? response.credential : "";
			if (credential === "") {
				setRuntimeErrorMessage("구글 credential 값을 확인할 수 없습니다.");
				return;
			}
			setRuntimeErrorMessage("");
			void onCredentialRef.current(credential, clientId);
		};
		activeGoogleCredentialHandler = handleCredentialResponse;

		// 구글 로그인 클라이언트는 전역 1회만 초기화합니다.
		initializeGoogleIdentityClient(clientId);

		// 버튼 컨테이너를 비운 뒤 현재 너비 기준으로 버튼을 렌더링합니다.
		buttonContainerRef.current.innerHTML = "";
		window.google.accounts.id.renderButton(buttonContainerRef.current, {
			type: "standard",
			theme: "filled_black",
			size: "large",
			text: "signin_with",
			shape: "rectangular",
			width: Math.max(280, Math.min(Math.floor(buttonContainerRef.current.clientWidth), 420)),
		});

		return () => {
			// 언마운트된 버튼 인스턴스로 credential 응답이 전달되지 않도록 정리합니다.
			if (activeGoogleCredentialHandler === handleCredentialResponse) {
				activeGoogleCredentialHandler = null;
			}
		};
	}, [clientId, isClientIdMissing, isGoogleScriptLoaded]);

	return (
		<section className={styles.buttonSection} aria-label="구글 로그인 영역">
			<Script
				id="google-identity-services-client"
				src="https://accounts.google.com/gsi/client"
				strategy="afterInteractive"
				onLoad={() => {
					// 스크립트 로드 완료 시 버튼 렌더링을 시작합니다.
					setRuntimeErrorMessage("");
					setIsGoogleScriptLoaded(true);
				}}
				onError={() => {
					// 스크립트 로드 실패 시 오류 문구를 노출합니다.
					setRuntimeErrorMessage("구글 로그인 스크립트를 불러오지 못했습니다.");
				}}
			/>

			<div className={styles.buttonWrap}>
				<div ref={buttonContainerRef} className={styles.buttonContainer} />
			</div>
			<p className={`${styles.messageText} ${isError ? styles.errorText : ""}`}>{message}</p>
		</section>
	);
}
