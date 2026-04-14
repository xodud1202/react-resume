import Head from "next/head";
import Link from "next/link";

interface LandingMenuButton {
	label: string;
	href: string;
	description: string;
}

const LANDING_MENU_BUTTON_LIST: LandingMenuButton[] = [
	{
		label: "이력서",
		href: "/resume",
		description: "이력서 화면으로 이동합니다.",
	},
	{
		label: "뉴스",
		href: "/news",
		description: "뉴스 RSS 조회 리스트로 이동합니다.",
	},
	{
		label: "스니펫",
		href: "/snippet",
		description: "개인 스니펫 저장소로 이동합니다.",
	},
	{
		label: "업무관리",
		href: "/work",
		description: "업무관리 화면으로 이동합니다.",
	},
];

/**
 * index.HomePage : 루트 진입 메뉴 화면을 렌더링합니다.
 */
export default function HomePage() {
	return (
		<>
			<Head>
				<title>react-resume</title>
				<meta name="description" content="react-resume 진입 메뉴" />
			</Head>

			<div className="min-h-screen bg-slate-50 px-6 py-10">
				<div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-4xl items-center justify-center">
					<div className="flex w-full max-w-xl flex-col items-center gap-5 rounded border border-slate-200 bg-white px-8 py-10 shadow-sm">
						<div className="text-center">
							<p className="text-sm font-semibold tracking-[0.22em] text-slate-400">WORKSPACE</p>
							<h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">메뉴</h1>
						</div>

						<div className="flex w-full flex-col gap-3">
							{LANDING_MENU_BUTTON_LIST.map((menuButton) => (
								<Link
									key={menuButton.href}
									href={menuButton.href}
									aria-label={menuButton.description}
									className="inline-flex h-14 w-full items-center justify-center rounded border border-slate-300 bg-slate-900 px-5 text-base font-semibold text-white transition-colors hover:bg-black"
								>
									{menuButton.label}
								</Link>
							))}
						</div>
					</div>
				</div>
			</div>
		</>
	);
}
