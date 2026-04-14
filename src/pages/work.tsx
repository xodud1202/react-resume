import Head from "next/head";
import Link from "next/link";

/**
 * work.WorkPage : 업무관리 임시 진입 화면을 렌더링합니다.
 */
export default function WorkPage() {
	return (
		<>
			<Head>
				<title>업무관리</title>
				<meta name="description" content="업무관리 준비 화면" />
			</Head>

			<div className="min-h-screen bg-slate-50 px-6 py-10">
				<div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl flex-col items-center justify-center gap-5 rounded border border-slate-200 bg-white px-8 py-10 text-center shadow-sm">
					<p className="text-sm font-semibold tracking-[0.18em] text-slate-400">WORKSPACE</p>
					<h1 className="text-3xl font-bold tracking-tight text-slate-900">업무관리</h1>
					<p className="max-w-xl text-sm leading-7 text-slate-500">업무관리 화면은 다음 단계에서 연결할 수 있도록 임시 진입 페이지로 준비해두었습니다.</p>
					<Link
						href="/"
						className="inline-flex h-11 items-center justify-center rounded border border-slate-300 bg-slate-900 px-5 text-sm font-semibold text-white transition-colors hover:bg-black"
					>
						메뉴로 돌아가기
					</Link>
				</div>
			</div>
		</>
	);
}
