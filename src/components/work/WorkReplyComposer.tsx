import { useEffect, useRef, useState, type ChangeEvent } from "react";
import LazyQuillEditor from "@/components/work/LazyQuillEditor";
import type { WorkReplyComposerSubmitPayload, WorkReplyFile } from "@/components/work/types";
import useWorkQuillImageUpload from "@/components/work/useWorkQuillImageUpload";
import { hasVisibleEditorText, isImageReplyFile, isImageSelectedFile } from "@/components/work/workAttachmentUtils";
import styles from "./WorkWorkspacePage.module.css";

type WorkReplyComposerMode = "create" | "edit";

const REPLY_EDITOR_TOOLBAR_OPTIONS = [
	[{ header: [1, 2, 3, false] }],
	["bold", "italic", "underline", "strike"],
	[{ list: "ordered" }, { list: "bullet" }],
	[{ color: [] }, { background: [] }],
	["blockquote", "code-block", "link", "image"],
	["clean"],
];
const REPLY_EDITOR_FORMATS = [
	"header",
	"bold",
	"italic",
	"underline",
	"strike",
	"list",
	"color",
	"background",
	"blockquote",
	"code-block",
	"link",
	"image",
];

interface WorkReplyComposerProps {
	// 댓글 컴포저 모드입니다.
	mode: WorkReplyComposerMode;
	// 현재 업무 번호입니다.
	workSeq: number;
	// 수정 중 댓글 번호입니다.
	replySeq?: number | null;
	// 초기 댓글 본문 HTML입니다.
	initialHtml: string;
	// 기존 댓글 첨부 목록입니다.
	existingFiles?: WorkReplyFile[];
	// 저장 진행 여부입니다.
	isSubmitting: boolean;
	// 저장 완료 시 true를 반환하는 저장 처리기입니다.
	onSubmit: (payload: WorkReplyComposerSubmitPayload) => Promise<boolean>;
	// 편집 취소 처리기입니다.
	onCancel?: () => void;
	// 에디터 오류 메시지 전달 처리기입니다.
	onError: (message: string) => void;
	// 이미지 미리보기 열기 처리기입니다.
	onPreviewImage: (imageUrl: string) => void;
	// 기존 첨부 다운로드 처리기입니다.
	onDownloadFile: (file: WorkReplyFile) => void;
	// 인라인 이미지 업로드 진행 상태 변경 처리기입니다.
	onInlineImageUploadingChange?: (isUploading: boolean) => void;
}

// 댓글 작성/수정 Quill 상태를 로컬에 고정하는 전용 컴포저입니다.
export default function WorkReplyComposer({
	mode,
	workSeq,
	replySeq = null,
	initialHtml,
	existingFiles = [],
	isSubmitting,
	onSubmit,
	onCancel,
	onError,
	onPreviewImage,
	onDownloadFile,
	onInlineImageUploadingChange,
}: WorkReplyComposerProps) {
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const [commentHtml, setCommentHtml] = useState(initialHtml);
	const [newFiles, setNewFiles] = useState<File[]>([]);
	const [deleteReplyFileSeqList, setDeleteReplyFileSeqList] = useState<number[]>([]);
	const editorId = `work-reply-composer-${mode}-${workSeq}-${replySeq ?? "new"}`;
	const replyQuill = useWorkQuillImageUpload({
		toolbarOptions: REPLY_EDITOR_TOOLBAR_OPTIONS,
		formats: REPLY_EDITOR_FORMATS,
		onChange: setCommentHtml,
		editorId,
		onError,
	});

	// 현재 인라인 이미지 업로드 상태를 부모에 동기화합니다.
	useEffect(() => {
		onInlineImageUploadingChange?.(replyQuill.isUploadingInlineImage);
	}, [onInlineImageUploadingChange, replyQuill.isUploadingInlineImage]);

	// 컴포넌트가 닫힐 때 업로드 상태를 안전하게 해제합니다.
	useEffect(() => {
		return () => {
			onInlineImageUploadingChange?.(false);
		};
	}, [onInlineImageUploadingChange]);

	// 새 첨부파일 선택을 로컬 draft에 누적합니다.
	const handleChangeFiles = (event: ChangeEvent<HTMLInputElement>) => {
		const nextFileList = Array.from(event.target.files || []);
		if (nextFileList.length < 1) {
			return;
		}
		setNewFiles((prevState) => [...prevState, ...nextFileList]);
		event.target.value = "";
	};

	// 선택한 새 첨부파일 하나를 제거합니다.
	const handleRemoveNewFile = (targetIndex: number) => {
		setNewFiles((prevState) => prevState.filter((_, fileIndex) => fileIndex !== targetIndex));
	};

	// 수정 모드 기존 첨부파일 삭제 대상을 토글합니다.
	const handleToggleDeleteExistingFile = (replyFileSeq: number) => {
		setDeleteReplyFileSeqList((prevState) => (
			prevState.includes(replyFileSeq)
				? prevState.filter((targetSeq) => targetSeq !== replyFileSeq)
				: [...prevState, replyFileSeq]
		));
	};

	// 신규 댓글 저장 성공 시 로컬 draft를 비웁니다.
	const resetCreateDraft = () => {
		setCommentHtml("");
		setNewFiles([]);
		setDeleteReplyFileSeqList([]);
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	};

	// 현재 draft가 저장 가능한지 확인한 뒤 부모 저장 처리기를 호출합니다.
	const handleSubmit = async () => {
		const activeExistingFileCount = existingFiles.filter(
			(fileItem) => !deleteReplyFileSeqList.includes(fileItem.replyFileSeq),
		).length;
		if (!hasVisibleEditorText(commentHtml) && activeExistingFileCount < 1 && newFiles.length < 1) {
			onError("댓글 내용 또는 첨부파일을 등록해주세요.");
			return;
		}

		// 댓글 본문과 첨부 draft를 부모 저장 함수에 한 번에 전달합니다.
		const isSaved = await onSubmit({
			replyComment: commentHtml,
			newFiles,
			deleteReplyFileSeqList,
		});
		if (isSaved && mode === "create") {
			resetCreateDraft();
		}
	};

	// 로컬 선택 파일 타일을 렌더링합니다.
	const renderSelectedFileTile = (fileItem: File, key: string, onRemove: () => void) => (
		<div key={key} className={styles.fileTile}>
			<div className={styles.filePreviewFallback}>{isImageSelectedFile(fileItem) ? "IMG" : "FILE"}</div>
			<div className={styles.fileNameLabel}>{fileItem.name || "선택 파일"}</div>
			<button type="button" className={styles.fileDeleteButton} onClick={onRemove} disabled={isSubmitting}>
				제거
			</button>
		</div>
	);

	// 수정 모드 기존 첨부 타일을 렌더링합니다.
	const renderExistingReplyFileTile = (fileItem: WorkReplyFile) => {
		const isDeleted = deleteReplyFileSeqList.includes(fileItem.replyFileSeq);
		return (
			<div key={fileItem.replyFileSeq} className={`${styles.fileTile} ${isDeleted ? styles.fileTileDimmed : ""}`}>
				{isImageReplyFile(fileItem) && fileItem.replyFileUrl ? (
					<button type="button" className={styles.filePreviewButton} onClick={() => onPreviewImage(fileItem.replyFileUrl)}>
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img src={fileItem.replyFileUrl} alt={fileItem.replyFileNm || "댓글 첨부 이미지"} className={styles.filePreviewImage} />
					</button>
				) : (
					<button type="button" className={styles.filePreviewFallback} onClick={() => onDownloadFile(fileItem)}>
						FILE
					</button>
				)}
				<button type="button" className={styles.fileNameButton} onClick={() => onDownloadFile(fileItem)}>
					{fileItem.replyFileNm || "첨부파일"}
				</button>
				<button
					type="button"
					className={styles.fileDeleteButton}
					onClick={() => handleToggleDeleteExistingFile(fileItem.replyFileSeq)}
					disabled={isSubmitting}
				>
					{isDeleted ? "삭제취소" : "삭제"}
				</button>
			</div>
		);
	};

	return (
		<div className={mode === "edit" ? styles.replyEditShell : styles.replyEditorShell}>
			<div className={styles.quillShell}>
				<LazyQuillEditor
					id={editorId}
					ref={replyQuill.quillRef}
					theme="snow"
					value={commentHtml}
					onChange={replyQuill.handleEditorChange}
					modules={replyQuill.quillModules}
					formats={replyQuill.quillFormats}
				/>
			</div>
			{mode === "edit" ? (
				<div className={styles.fileTileGrid}>
					{existingFiles.map((fileItem) => renderExistingReplyFileTile(fileItem))}
					{newFiles.map((fileItem, fileIndex) => renderSelectedFileTile(fileItem, `${mode}-${fileIndex}`, () => handleRemoveNewFile(fileIndex)))}
					<button type="button" className={`${styles.fileTile} ${styles.fileTileAdd}`} onClick={() => fileInputRef.current?.click()} disabled={isSubmitting}>
						<span className={styles.fileAddIcon}>+</span>
						<span className={styles.fileNameLabel}>첨부 추가</span>
					</button>
				</div>
			) : (
				<div className={styles.replyComposerFooter}>
					<div className={`${styles.fileTileGrid} ${styles.replyComposerFiles}`}>
						{newFiles.map((fileItem, fileIndex) => renderSelectedFileTile(fileItem, `${mode}-${fileIndex}`, () => handleRemoveNewFile(fileIndex)))}
						<button type="button" className={`${styles.fileTile} ${styles.fileTileAdd}`} onClick={() => fileInputRef.current?.click()} disabled={isSubmitting}>
							<span className={styles.fileAddIcon}>+</span>
							<span className={styles.fileNameLabel}>댓글 파일</span>
						</button>
					</div>
					<div className={styles.replyComposerActions}>
						<button
							type="button"
							className={`${styles.primaryButton} ${styles.replyComposerSubmitButton}`}
							onClick={() => void handleSubmit()}
							disabled={isSubmitting}
						>
							{isSubmitting ? "저장 중..." : "댓글 등록"}
						</button>
					</div>
				</div>
			)}
			<input ref={fileInputRef} type="file" multiple className={styles.hiddenFileInput} onChange={handleChangeFiles} />
			{mode === "edit" ? (
				<div className={styles.replyActionRow}>
					<button type="button" className={styles.primaryButton} onClick={() => void handleSubmit()} disabled={isSubmitting}>
						{isSubmitting ? "저장 중..." : "수정 저장"}
					</button>
					{onCancel ? (
						<button type="button" className={styles.secondaryButton} onClick={onCancel} disabled={isSubmitting}>
							취소
						</button>
					) : null}
				</div>
			) : null}
		</div>
	);
}
