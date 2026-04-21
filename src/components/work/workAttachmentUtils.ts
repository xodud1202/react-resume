import type { WorkFile, WorkReplyFile } from "@/components/work/types";

const WORK_IMAGE_FILE_PATTERN = /\.(png|jpe?g|gif|bmp|webp|svg)(\?|$)/i;

// 파일명과 URL 기준으로 이미지 첨부 여부를 판단합니다.
export function isImageAttachmentByValues(fileName: string, fileUrl?: string | null): boolean {
	return WORK_IMAGE_FILE_PATTERN.test(fileName || "") || WORK_IMAGE_FILE_PATTERN.test(fileUrl || "");
}

// 업무 첨부파일이 이미지인지 판단합니다.
export function isImageWorkFile(file: WorkFile): boolean {
	return isImageAttachmentByValues(file.workJobFileNm, file.workJobFileUrl);
}

// 댓글 첨부파일이 이미지인지 판단합니다.
export function isImageReplyFile(file: WorkReplyFile): boolean {
	return isImageAttachmentByValues(file.replyFileNm, file.replyFileUrl);
}

// 브라우저에서 선택한 파일이 이미지인지 판단합니다.
export function isImageSelectedFile(file: File): boolean {
	return file.type.startsWith("image/") || isImageAttachmentByValues(file.name);
}

// Quill HTML에서 실제 보이는 텍스트가 있는지 판단합니다.
export function hasVisibleEditorText(value: string): boolean {
	return value.replace(/<img[^>]*>/gi, " IMG ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() !== "";
}
