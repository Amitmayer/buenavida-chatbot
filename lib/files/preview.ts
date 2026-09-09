export function canPreviewFile(mimeType: string): boolean {
  if (mimeType === "application/pdf") return true;
  return mimeType.startsWith("image/") && mimeType !== "image/svg+xml" && mimeType !== "image/svg";
}
