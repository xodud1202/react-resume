import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import type ReactQuill from "react-quill-new";
import type Quill from "quill";

type QuillToolbarOptions = unknown[];
type QuillEditorInstance = Quill;

interface QuillDomElement extends HTMLElement {
	// DOM에 직접 붙어 있는 Quill 인스턴스입니다.
	__quill?: QuillEditorInstance;
}

interface QuillToolbarModule {
	// 툴바 핸들러를 등록합니다.
	addHandler?: (formatName: string, handler: () => void) => void;
}

interface QuillWindow extends Window {
	// Quill 전역 객체입니다.
	Quill?: {
		// DOM 기준 Quill 인스턴스를 조회합니다.
		find?: (target: Element) => unknown;
	};
}

interface WorkQuillImageUploadOptions {
	// Quill 툴바 옵션입니다.
	toolbarOptions: QuillToolbarOptions;
	// Quill 허용 포맷 목록입니다.
	formats: string[];
	// 에디터 값 변경 콜백입니다.
	onChange: (value: string) => void;
	// 에디터 DOM id입니다.
	editorId?: string;
	// 업로드 오류를 외부 피드백 레이어로 전달합니다.
	onError?: (message: string) => void;
}

interface WorkQuillImageUploadResult {
	// Quill ref입니다.
	quillRef: MutableRefObject<ReactQuill | null>;
	// Quill 모듈 설정입니다.
	quillModules: Record<string, unknown>;
	// Quill 포맷 목록입니다.
	quillFormats: string[];
	// 에디터 값 변경 핸들러입니다.
	handleEditorChange: (value: string) => void;
	// 이미지 업로드 진행 여부입니다.
	isUploadingInlineImage: boolean;
}

// 업무 댓글 Quill 에디터 이미지 업로드/붙여넣기 처리를 공통화합니다.
const useWorkQuillImageUpload = ({
	toolbarOptions,
	formats,
	onChange,
	editorId,
	onError,
}: WorkQuillImageUploadOptions): WorkQuillImageUploadResult => {
	const quillRef = useRef<ReactQuill | null>(null);
	const [isUploadingInlineImage, setIsUploadingInlineImage] = useState(false);

	// 에디터 id 기준 Quill 인스턴스를 찾습니다.
	const resolveEditorById = useCallback((): QuillEditorInstance | null => {
		if (!editorId || typeof document === "undefined") {
			return null;
		}
		const rootElement = document.getElementById(editorId);
		if (!rootElement) {
			return null;
		}
		const editor = (rootElement as QuillDomElement).__quill;
		if (editor && typeof editor.insertEmbed === "function") {
			return editor;
		}
		const containerElement = rootElement.querySelector(".ql-container") || rootElement;
		const quillGlobal = typeof window !== "undefined" ? (window as QuillWindow).Quill : null;
		if (quillGlobal && typeof quillGlobal.find === "function") {
			const quill = quillGlobal.find(containerElement);
			if (quill && typeof quill === "object" && "insertEmbed" in quill) {
				return quill as QuillEditorInstance;
			}
		}
		return null;
	}, [editorId]);

	// ref와 id 기준으로 Quill 인스턴스를 안전하게 확인합니다.
	const resolveEditor = useCallback((): QuillEditorInstance | null => {
		const ref = quillRef.current;
		if (!ref) {
			return resolveEditorById();
		}
		if (typeof ref.getEditor === "function") {
			return ref.getEditor();
		}
		if (ref.editor) {
			return ref.editor;
		}
		return resolveEditorById();
	}, [resolveEditorById]);

	// Quill 인스턴스가 늦게 붙는 경우를 대비해 재시도합니다.
	const resolveEditorWithRetry = useCallback(async (retryCount = 5, delayMs = 80): Promise<QuillEditorInstance | null> => {
		for (let index = 0; index < retryCount; index += 1) {
			const editor = resolveEditor();
			if (editor && typeof editor.insertEmbed === "function") {
				return editor;
			}
			await new Promise((resolve) => setTimeout(resolve, delayMs));
		}
		return null;
	}, [resolveEditor]);

	// data URL 문자열을 File 객체로 변환합니다.
	const convertDataUrlToFile = useCallback(async (dataUrl: string, fileName: string) => {
		const response = await fetch(dataUrl);
		const blob = await response.blob();
		return new File([blob], fileName, { type: blob.type });
	}, []);

	// 에디터 이미지를 서버에 업로드합니다.
	const uploadEditorImage = useCallback(async (file: File) => {
		const formData = new FormData();
		formData.append("image", file);
		const response = await fetch("/api/upload/editor-image", {
			method: "POST",
			body: formData,
			credentials: "include",
		});
		const payload = await response.json().catch(() => null);
		if (!response.ok) {
			const errorMessage = typeof payload?.error === "string" ? payload.error : typeof payload?.message === "string" ? payload.message : "이미지 업로드에 실패했습니다.";
			throw new Error(errorMessage);
		}
		const imageUrl = typeof payload?.imageUrl === "string" ? payload.imageUrl : "";
		if (imageUrl === "") {
			throw new Error("이미지 업로드 응답을 확인해주세요.");
		}
		return imageUrl;
	}, []);

	// 툴바 이미지 버튼 클릭 시 파일 선택 업로드를 처리합니다.
	const handleImageUpload = useCallback(() => {
		if (isUploadingInlineImage) {
			return;
		}
		const inputElement = document.createElement("input");
		inputElement.type = "file";
		inputElement.accept = "image/*";
		inputElement.onchange = async () => {
			if (!inputElement.files || inputElement.files.length < 1) {
				return;
			}
			const file = inputElement.files[0];
			setIsUploadingInlineImage(true);
			try {
				const imageUrl = await uploadEditorImage(file);
				const quill = await resolveEditorWithRetry();
				if (!quill || typeof quill.insertEmbed !== "function") {
					throw new Error("에디터를 찾을 수 없습니다.");
				}
				const range = quill.getSelection?.(true);
				const insertIndex = range ? range.index : quill.getLength?.() ?? 0;
				quill.insertEmbed(insertIndex, "image", imageUrl, "user");
				quill.setSelection(insertIndex + 1, 0);
			} catch (error) {
				console.error("업무 댓글 이미지 업로드에 실패했습니다.", error);
				onError?.(error instanceof Error ? error.message : "이미지 업로드에 실패했습니다.");
			} finally {
				setIsUploadingInlineImage(false);
			}
		};
		inputElement.click();
	}, [isUploadingInlineImage, onError, resolveEditorWithRetry, uploadEditorImage]);

	// 붙여넣은 base64 이미지를 업로드 URL로 치환합니다.
	const replaceInlineImage = useCallback(async (value: string) => {
		if (isUploadingInlineImage) {
			return;
		}
		const matches = Array.from(value.matchAll(/<img[^>]+src=["'](data:image\/[^"']+)["']/gi));
		if (matches.length < 1) {
			return;
		}

		setIsUploadingInlineImage(true);
		try {
			let replacedValue = value;
			for (let index = 0; index < matches.length; index += 1) {
				const dataUrl = matches[index][1];
				if (!dataUrl) {
					continue;
				}
				const file = await convertDataUrlToFile(dataUrl, `work_reply_${Date.now()}_${index + 1}.png`);
				const imageUrl = await uploadEditorImage(file);
				replacedValue = replacedValue.replace(dataUrl, imageUrl);
			}
			if (replacedValue !== value) {
				onChange(replacedValue);
			}
		} catch (error) {
			console.error("업무 댓글 붙여넣기 이미지 업로드에 실패했습니다.", error);
			onError?.(error instanceof Error ? error.message : "이미지 업로드에 실패했습니다.");
		} finally {
			setIsUploadingInlineImage(false);
		}
	}, [convertDataUrlToFile, isUploadingInlineImage, onChange, onError, uploadEditorImage]);

	// Quill 툴바 이미지 핸들러를 연결합니다.
	useEffect(() => {
		const editor = resolveEditor();
		const toolbar = editor?.getModule?.("toolbar") as QuillToolbarModule | undefined;
		if (toolbar?.addHandler) {
			toolbar.addHandler("image", handleImageUpload);
		}
	}, [handleImageUpload, resolveEditor]);

	// Quill 모듈 설정을 메모이즈합니다.
	const quillModules = useMemo(
		() => ({
			toolbar: {
				container: toolbarOptions,
				handlers: {
					image: handleImageUpload,
				},
			},
		}),
		[handleImageUpload, toolbarOptions],
	);

	// 에디터 값 변경과 붙여넣기 이미지 업로드를 함께 처리합니다.
	const handleEditorChange = useCallback((value: string) => {
		onChange(value);
		void replaceInlineImage(value);
	}, [onChange, replaceInlineImage]);

	return {
		quillRef,
		quillModules,
		quillFormats: formats,
		handleEditorChange,
		isUploadingInlineImage,
	};
};

export default useWorkQuillImageUpload;
