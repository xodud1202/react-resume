import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { refreshWorkSession, requestWorkClientApi, type WorkClientApiRequestOptions } from "@/services/workApiService";

const PATH = "/work/reading";
const API = "/api/work/reading-records";
const EMPTY = { title: "", author: "", translator: "", startedOn: "", completedOn: "", content: "", rating: "", notes: "" };
const SCORES = Array.from({ length: 11 }, (_, index) => (index / 2).toFixed(1));
const INPUT = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700";
const CARD = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6";

interface ReadingRecord {
	id: number;
	title: string;
	author: string;
	translator: string | null;
	startedOn: string | null;
	completedOn: string | null;
	content: string | null;
	rating: number | null;
	notes: string | null;
}

export default function ReadingPage() {
	const router = useRouter();
	const [form, setForm] = useState(EMPTY);
	const [records, setRecords] = useState<ReadingRecord[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [listError, setListError] = useState("");
	const [formError, setFormError] = useState("");
	const [success, setSuccess] = useState("");
	const saveLock = useRef(false);

	const request = useCallback(async <T,>(options: WorkClientApiRequestOptions) => {
		let result = await requestWorkClientApi<T>(API, { cache: "no-store", ...options });
		if (result.status === 401 && !options.signal?.aborted) {
			const restored = await refreshWorkSession();
			if (restored.ok && !options.signal?.aborted) {
				result = await requestWorkClientApi<T>(API, { cache: "no-store", ...options });
			}
			if (result.status === 401 && !options.signal?.aborted) {
				await router.replace("/work/login?returnUrl=" + encodeURIComponent(PATH));
			}
		}
		return result;
	}, [router]);

	const loadRecords = useCallback(async (signal?: AbortSignal) => {
		setListError("");
		setLoading(true);
		try {
			const result = await request<ReadingRecord[]>({ signal });
			if (signal?.aborted) return;
			if (result.ok && Array.isArray(result.data)) {
				setRecords(result.data);
			} else {
				if (result.status === 401 || result.status === 403) setRecords([]);
				setListError(result.status === 401 ? "다시 로그인해 주세요." : "목록을 불러오지 못했습니다.");
			}
		} catch (error) {
			if (!signal?.aborted && !(error instanceof DOMException && error.name === "AbortError")) {
				setListError("목록을 불러오지 못했습니다.");
			}
		} finally {
			if (!signal?.aborted) setLoading(false);
		}
	}, [request]);

	useEffect(() => {
		const controller = new AbortController();
		void loadRecords(controller.signal);
		return () => controller.abort();
	}, [loadRecords]);

	function update(field: keyof typeof EMPTY, value: string) {
		setForm((previous) => ({ ...previous, [field]: value }));
	}

	async function save(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (saveLock.current) return;
		setFormError("");
		setSuccess("");
		if (!form.title.trim() || !form.author.trim()) {
			setFormError("제목과 지은이를 입력해 주세요.");
			return;
		}
		if (form.startedOn && form.completedOn && form.completedOn < form.startedOn) {
			setFormError("독서 완료일은 시작일보다 빠를 수 없습니다.");
			return;
		}
		saveLock.current = true;
		setSaving(true);
		try {
			const result = await request<{ message: string }>({
				method: "POST",
				body: {
					title: form.title.trim(),
					author: form.author.trim(),
					translator: form.translator.trim() || null,
					startedOn: form.startedOn || null,
					completedOn: form.completedOn || null,
					content: form.content.trim() || null,
					rating: form.rating === "" ? null : Number(form.rating),
					notes: form.notes.trim() || null,
				},
			});
			if (!result.ok) {
				setFormError(result.status === 400 && result.message ? result.message : "기록을 저장하지 못했습니다.");
				return;
			}
			setForm(EMPTY);
			setSuccess("독서 기록을 저장했습니다.");
			await loadRecords();
		} catch {
			setFormError("기록을 저장하지 못했습니다.");
		} finally {
			saveLock.current = false;
			setSaving(false);
		}
	}

	return (
		<>
			<Head><title>독서 기록</title><meta name="robots" content="noindex, nofollow" /></Head>
			<main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-8">
				<div className="mx-auto max-w-6xl">
					<header className="mb-7">
						<Link href="/" className="text-sm font-semibold text-teal-800 underline-offset-4 hover:underline">메인 메뉴</Link>
						<h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">독서 기록</h1>
						<p className="mt-2 text-sm text-slate-600">읽은 책과 기억해 두고 싶은 소감을 한곳에 모아보세요.</p>
					</header>
					<div className="grid items-start gap-6 lg:grid-cols-2">
						<section className={CARD} aria-labelledby="reading-create">
							<h2 id="reading-create" className="mb-4 text-xl font-semibold">새 기록</h2>
							<form onSubmit={save}>
								<fieldset disabled={saving} className="space-y-4">
									{([["title", "제목", true], ["author", "지은이", true], ["translator", "옮긴이", false]] as const).map(([field, label, required]) => (
										<label key={field} className="block space-y-1 text-sm font-medium">
											<span>{label}{required ? " (필수)" : ""}</span>
											<input className={INPUT} required={required} maxLength={200} value={form[field]} onChange={(event) => update(field, event.target.value)} />
										</label>
									))}
									<div className="grid gap-4 sm:grid-cols-2">
										<label className="block space-y-1 text-sm font-medium">
											<span>독서 시작일</span>
											<input className={INPUT} type="date" value={form.startedOn} onChange={(event) => update("startedOn", event.target.value)} />
										</label>
										<label className="block space-y-1 text-sm font-medium">
											<span>독서 완료일</span>
											<input className={INPUT} type="date" min={form.startedOn || undefined} value={form.completedOn} onChange={(event) => update("completedOn", event.target.value)} />
										</label>
									</div>
									<label className="block space-y-1 text-sm font-medium">
										<span>내용</span>
										<textarea className={INPUT} rows={3} maxLength={200} aria-describedby="reading-content-length" value={form.content} onChange={(event) => update("content", event.target.value)} />
										<span id="reading-content-length" className="block text-right text-xs text-slate-600">{form.content.length} / 200</span>
									</label>
									<label className="block space-y-1 text-sm font-medium">
										<span>평점 (5점 만점)</span>
										<select className={INPUT} value={form.rating} onChange={(event) => update("rating", event.target.value)}>
											<option value="">평점 없음</option>
											{SCORES.map((score) => <option key={score} value={score}>{score}점</option>)}
										</select>
									</label>
									<label className="block space-y-1 text-sm font-medium">
										<span>비고 (소감)</span>
										<textarea className={INPUT} rows={4} maxLength={4000} value={form.notes} onChange={(event) => update("notes", event.target.value)} />
									</label>
									<button type="submit" className="rounded-lg bg-teal-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-950 disabled:opacity-60">
										{saving ? "저장 중…" : "기록 저장"}
									</button>
								</fieldset>
								{formError && <p role="alert" className="mt-3 text-sm text-red-700">{formError}</p>}
								{success && <p role="status" className="mt-3 text-sm text-teal-800">{success}</p>}
							</form>
						</section>
						<section aria-labelledby="reading-list" aria-busy={loading}>
							<h2 id="reading-list" className="mb-3 text-xl font-semibold">기록 목록</h2>
							{loading && <p role="status" className={CARD}>기록을 불러오는 중…</p>}
							{listError && <div className={CARD}>
								<p role="alert" className="text-red-700">{listError}</p>
								<button type="button" onClick={() => void loadRecords()} className="mt-2 text-sm font-semibold text-teal-800 underline">다시 조회</button>
							</div>}
							{!loading && !listError && records.length === 0 && <p className={CARD}>아직 독서 기록이 없습니다.</p>}
							{records.length > 0 && <ul className="space-y-3">
								{records.map((record) => (
									<li key={record.id} className={CARD}>
										<div className="flex flex-wrap items-baseline justify-between gap-2">
											<h3 className="min-w-0 break-all text-lg font-semibold">{record.title}</h3>
											{record.rating != null && <span className="rounded-full bg-teal-50 px-2.5 py-1 text-sm font-semibold text-teal-900">{record.rating.toFixed(1)} / 5</span>}
										</div>
										<p className="mt-1 break-all text-sm text-slate-600">지은이 {record.author}{record.translator && <> · 옮긴이 {record.translator}</>}</p>
										{(record.startedOn || record.completedOn) && <p className="mt-2 text-sm text-slate-600">
											시작일 {record.startedOn ?? "미기록"} · 완료일 {record.completedOn ?? "미기록"}
										</p>}
										{record.content && <p className="mt-3 whitespace-pre-wrap break-words text-sm"><strong>내용</strong> {record.content}</p>}
										{record.notes && <p className="mt-2 whitespace-pre-wrap break-words text-sm"><strong>비고</strong> {record.notes}</p>}
									</li>
								))}
							</ul>}
						</section>
					</div>
				</div>
			</main>
		</>
	);
}
