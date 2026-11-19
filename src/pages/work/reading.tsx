import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { refreshWorkSession, requestWorkClientApi, type WorkClientApiRequestOptions } from "@/services/workApiService";

const PATH = "/work/reading";
const API = "/api/work/reading-records";
const EMPTY = { title: "", author: "", translator: "", startedOn: "", completedOn: "", content: "", rating: "", notes: "" };
const FILTERS = { title: "", author: "", from: "", to: "" };
const SCORES = Array.from({ length: 11 }, (_, index) => (index / 2).toFixed(1));
const INPUT = "w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400";
const CARD = "rounded-2xl border border-zinc-800 bg-[#111111] p-5 shadow-sm sm:p-6";

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
	const [filters, setFilters] = useState(FILTERS);
	const [applied, setApplied] = useState(FILTERS);
	const [searchError, setSearchError] = useState("");
	const [dialog, setDialog] = useState<{ kind: "create" | "edit" | "detail" | "delete"; record?: ReadingRecord } | null>(null);
	const [detailLoading, setDetailLoading] = useState(false);
	const modal = useRef<HTMLDialogElement>(null);
	const detailRequest = useRef<AbortController | null>(null);
	const listRequest = useRef<AbortController | null>(null);
	const [detailReady, setDetailReady] = useState(false);
	const [form, setForm] = useState(EMPTY);
	const [records, setRecords] = useState<ReadingRecord[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [listError, setListError] = useState("");
	const [formError, setFormError] = useState("");
	const [success, setSuccess] = useState("");
	const saveLock = useRef(false);

	const request = useCallback(async <T,>(options: WorkClientApiRequestOptions, suffix = "") => {
		let result = await requestWorkClientApi<T>(API + suffix, { cache: "no-store", ...options });
		if (result.status === 401 && !options.signal?.aborted) {
			const restored = await refreshWorkSession();
			if (restored.ok && !options.signal?.aborted) {
				result = await requestWorkClientApi<T>(API + suffix, { cache: "no-store", ...options });
			}
			if (result.status === 401 && !options.signal?.aborted) {
				await router.replace("/work/login?returnUrl=" + encodeURIComponent(PATH));
			}
		}
		return result;
	}, [router]);

	const loadRecords = useCallback(async () => {
		listRequest.current?.abort();
		const controller = new AbortController();
		listRequest.current = controller;
		const signal = controller.signal;
		setListError("");
		setLoading(true);
		try {
			const query = new URLSearchParams();
			for (const [key, value] of Object.entries(applied)) {
				if (value.trim()) query.set(key, value.trim());
			}
			const result = await request<ReadingRecord[]>({ signal }, query.size ? "?" + query.toString() : "");
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
	}, [applied, request]);

	useEffect(() => {
		void loadRecords();
		return () => listRequest.current?.abort();
	}, [loadRecords]);

	useEffect(() => {
		const element = modal.current;
		if (dialog && element && !element.open) element.showModal();
	}, [dialog]);

	useEffect(() => () => detailRequest.current?.abort(), []);

	function open(kind: "create" | "edit" | "detail" | "delete", record?: ReadingRecord) {
		setFormError("");
		setForm(EMPTY);
		setDetailReady(false);
		setDialog({kind, record});
		if (!record || (kind !== "detail" && kind !== "edit")) return;
		detailRequest.current?.abort();
		const controller = new AbortController();
		detailRequest.current = controller;
		setDetailLoading(true);
		void (async () => {
			try {
				const result = await request<ReadingRecord>({signal: controller.signal}, "/" + record.id);
				if (controller.signal.aborted) return;
				if (result.ok && result.data) {
					const entry = result.data;
					setDetailReady(true);
					setDialog({kind, record: entry});
					setForm({
						title: entry.title, author: entry.author, translator: entry.translator ?? "",
						startedOn: entry.startedOn ?? "", completedOn: entry.completedOn ?? "",
						content: entry.content ?? "", rating: entry.rating?.toFixed(1) ?? "", notes: entry.notes ?? "",
					});
				} else setFormError("기록을 불러오지 못했습니다.");
			} catch {
				if (!controller.signal.aborted) setFormError("기록을 불러오지 못했습니다.");
			} finally {
				if (!controller.signal.aborted) setDetailLoading(false);
			}
		})();
	}

	function close() {
		detailRequest.current?.abort();
		setDetailLoading(false);
		modal.current?.close();
		setDialog(null);
	}

	async function remove() {
		if (saveLock.current || dialog?.kind !== "delete" || !dialog.record) return;
		saveLock.current = true;
		setSaving(true);
		setFormError("");
		setSuccess("");
		try {
			const result = await request({method: "DELETE"}, "/" + dialog.record.id);
			if (!result.ok) {
				setFormError(result.message || "기록을 삭제하지 못했습니다.");
				return;
			}
			close();
			setSuccess("독서 기록을 삭제했습니다.");
			await loadRecords();
		} catch {
			setFormError("기록을 삭제하지 못했습니다.");
		} finally {
			saveLock.current = false;
			setSaving(false);
		}
	}

	function update(field: keyof typeof EMPTY, value: string) {
		setForm((previous) => ({ ...previous, [field]: value }));
	}

	async function save(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (saveLock.current || (dialog?.kind !== "create" && dialog?.kind !== "edit") || (dialog.kind === "edit" && (!detailReady || !dialog.record))) return;
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
				method: dialog.kind === "edit" ? "PUT" : "POST",
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
			}, dialog.kind === "edit" ? "/" + dialog.record?.id : "");
			if (!result.ok) {
				setFormError(result.status === 400 && result.message ? result.message : "기록을 저장하지 못했습니다.");
				return;
			}
			close();
			setSuccess("독서 기록을 저장했습니다.");
			await loadRecords();
		} catch {
			setFormError("기록을 저장하지 못했습니다.");
		} finally {
			saveLock.current = false;
			setSaving(false);
		}
	}

	return <>
		<Head><title>독서 기록</title><meta name="robots" content="noindex, nofollow" /></Head>
		<main className="min-h-screen bg-black px-4 py-8 text-zinc-50 [color-scheme:dark] sm:px-8">
			<div className="mx-auto max-w-6xl">
				<Link href="/" className="text-sm font-medium text-zinc-400 hover:text-zinc-50">← 메인 메뉴</Link>
				<header className="my-6 flex items-center justify-between gap-3">
					<h1 className="text-3xl font-bold tracking-tight">독서 기록</h1>
					<button type="button" disabled={saving} onClick={() => open("create")} className="rounded-lg bg-zinc-100 px-4 py-2 font-semibold text-zinc-950 hover:bg-white">+ 등록</button>
				</header>
				<section className={CARD} aria-label="독서 기록 검색">
					<form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={(event) => {
						event.preventDefault();
						if (filters.from && filters.to && filters.from > filters.to) {
							setSearchError("검색 종료일은 시작일보다 빠를 수 없습니다.");
							return;
						}
						setSearchError("");
						setApplied({...filters});
					}}>
						{([["title", "제목", "text"], ["author", "지은이", "text"], ["from", "독서기간 시작", "date"], ["to", "독서기간 종료", "date"]] as const).map(([key, label, type]) => (
							<label key={key} className="grid gap-1.5 text-sm">
								{label}<input className={INPUT} type={type} maxLength={200} value={filters[key]} onChange={(event) => setFilters({...filters, [key]: event.target.value})} />
							</label>
						))}
						<div className="flex gap-2 sm:col-span-2 lg:col-span-4 lg:justify-end">
							<button type="button" className="rounded-lg border border-zinc-700 px-4 py-2 hover:bg-zinc-800" onClick={() => {setFilters(FILTERS); setApplied({...FILTERS});setSearchError("");}}>초기화</button>
							<button className="rounded-lg bg-teal-800 px-4 py-2 font-semibold hover:bg-teal-700">검색</button>
						</div>
					</form>
					{searchError && <p role="alert" className="mt-3 text-red-300">{searchError}</p>}
				</section>
				<section className="mt-6 overflow-hidden rounded-xl border border-zinc-800 bg-[#111111]" aria-label="기록 목록" aria-busy={loading}>
					{success && <p role="status" className="px-4 py-2 text-sm text-teal-300">{success}</p>}
					{loading ? <p role="status" className="p-5 text-zinc-400">기록을 불러오는 중…</p> :
						listError ? <div className="p-5"><p role="alert" className="text-red-300">{listError}</p><button onClick={() => void loadRecords()} className="mt-2 underline">다시 조회</button></div> :
						!records.length ? <p className="p-5 text-zinc-400">{Object.values(applied).some((item) => item.trim()) ? "검색 조건에 맞는 기록이 없습니다." : "아직 독서 기록이 없습니다."}</p> :
						<ul className="divide-y divide-zinc-800">
							{records.map((record) => <li key={record.id} className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6">
								<div className="min-w-0">
									<button type="button" disabled={saving} onClick={() => open("detail", record)} className="break-all text-left font-semibold text-teal-200 decoration-teal-500 underline-offset-4 hover:underline">{record.title}</button>
									<p className="mt-1 break-all text-sm text-zinc-400">{record.author}</p>
									{(record.startedOn || record.completedOn) && <p className="mt-1 text-xs text-zinc-400">{record.startedOn ?? "미기록"} ~ {record.completedOn ?? "미기록"}</p>}
								</div>
								<div className="flex shrink-0 gap-1.5">
									<button type="button" disabled={saving} aria-label={record.title + " 수정"} onClick={() => open("edit", record)} className="rounded-md border border-zinc-700 px-2 py-1.5 text-sm hover:bg-zinc-800 sm:px-3">수정</button>
									<button type="button" disabled={saving} aria-label={record.title + " 삭제"} onClick={() => open("delete", record)} className="rounded-md border border-red-900 px-2 py-1.5 text-sm text-red-300 hover:bg-red-950 sm:px-3">삭제</button>
								</div>
							</li>)}
						</ul>}
				</section>
			</div>
			{dialog && <dialog ref={modal} aria-labelledby="reading-dialog-title" className="[color-scheme:dark] m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto rounded-xl border border-zinc-700 bg-[#151515] p-5 text-zinc-50 backdrop:bg-black/75 sm:p-6" onCancel={(event) => {event.preventDefault();if (!saveLock.current) close();}}>
				<header className="mb-4 flex items-start justify-between gap-3">
					<h2 id="reading-dialog-title" className="break-all text-xl font-bold">{dialog.kind === "detail" ? dialog.record?.title : dialog.kind === "delete" ? "독서 기록 삭제" : dialog.kind === "create" ? "독서 기록 등록" : "독서 기록 수정"}</h2>
					<button type="button" disabled={saving} onClick={close} className="shrink-0 rounded-md px-2 py-1 text-sm text-zinc-300 hover:bg-zinc-800">닫기</button>
				</header>
				{detailLoading && <p role="status">기록을 불러오는 중…</p>}
				{formError && <p role="alert" className="mb-3 text-sm text-red-300">{formError}</p>}
				{!detailLoading && (dialog.kind === "create" || ((dialog.kind === "edit" || dialog.kind === "detail") && detailReady)) && (
					<form onSubmit={save}>
						<fieldset disabled={saving || detailLoading} className="space-y-4">
							{([["title", "제목", true], ["author", "지은이", true], ["translator", "옮긴이", false]] as const).map(([field, label, required]) => (
								<label key={field} className="block space-y-1 text-sm font-medium">
									<span>{label}{required && dialog.kind !== "detail" ? " (필수)" : ""}</span>
									<input className={INPUT} readOnly={dialog.kind === "detail"} required={required && dialog.kind !== "detail"} maxLength={200} value={form[field]} onChange={(event) => update(field, event.target.value)} />
								</label>
							))}
							<div className="grid gap-4 sm:grid-cols-2">
								<label className="block space-y-1 text-sm font-medium">
									<span>독서 시작일</span>
									<input className={INPUT} type="date" readOnly={dialog.kind === "detail"} value={form.startedOn} onChange={(event) => update("startedOn", event.target.value)} />
								</label>
								<label className="block space-y-1 text-sm font-medium">
									<span>독서 완료일</span>
									<input className={INPUT} type="date" readOnly={dialog.kind === "detail"} min={form.startedOn || undefined} value={form.completedOn} onChange={(event) => update("completedOn", event.target.value)} />
								</label>
							</div>
							<label className="block space-y-1 text-sm font-medium">
								<span>내용</span>
								<textarea readOnly={dialog.kind === "detail"} className={INPUT} rows={3} maxLength={200} aria-describedby="reading-content-length" value={form.content} onChange={(event) => update("content", event.target.value)} />
								<span id="reading-content-length" className="block text-right text-xs text-zinc-400">{form.content.length} / 200</span>
							</label>
							<label className="block space-y-1 text-sm font-medium">
								<span>평점 (5점 만점)</span>
								<select disabled={dialog.kind === "detail"} className={INPUT} value={form.rating} onChange={(event) => update("rating", event.target.value)}>
									<option value="">평점 없음</option>
									{SCORES.map((score) => <option key={score} value={score}>{score}점</option>)}
								</select>
							</label>
							<label className="block space-y-1 text-sm font-medium">
								<span>비고 (소감)</span>
								<textarea readOnly={dialog.kind === "detail"} className={INPUT} rows={4} maxLength={4000} value={form.notes} onChange={(event) => update("notes", event.target.value)} />
							</label>
							{dialog.kind !== "detail" && <button type="submit" className="rounded-lg bg-teal-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-950 disabled:opacity-60">
								{saving ? "저장 중…" : "저장"}
							</button>}
						</fieldset>


					</form>
				)}
				{dialog.kind === "delete" && <>
					<p><strong className="break-all">{dialog.record?.title}</strong> 기록을 삭제할까요? 삭제한 기록은 복구할 수 없습니다.</p>
					<div className="mt-5 flex justify-end gap-2">
						<button type="button" disabled={saving} onClick={close} className="rounded-md border border-zinc-700 px-4 py-2">취소</button>
						<button type="button" disabled={saving} onClick={() => void remove()} className="rounded-md bg-red-800 px-4 py-2 font-semibold hover:bg-red-700 disabled:opacity-60">{saving ? "삭제 중…" : "삭제 확인"}</button>
					</div>
				</>}
			</dialog>}
		</main>
	</>;
}
