export const MEDIA_LIMIT = 20 * 1024 * 1024;
export function mediaKind(type: string) {
  if (["image/jpeg", "image/png", "image/webp"].includes(type)) return "image";
  if (["video/mp4", "video/webm", "video/quicktime"].includes(type)) return "video";
  if (["audio/wav", "audio/mpeg", "audio/webm", "audio/mp4"].includes(type)) return "audio";
  throw new Error("Choose a JPG, PNG, WebP, MP4, WebM, MOV, WAV or MP3 file.");
}
export function validateMedia(type: string, size: number) {
  const kind = mediaKind(type);
  if (size <= 0 || size > MEDIA_LIMIT) throw new Error("Choose a non-empty file under 20 MB.");
  return kind;
}
export function ownedMediaPath(path: string, userId: string, threadId: string) {
  return (
    path.startsWith(`${userId}/${threadId}/`) &&
    !path.includes("..") &&
    path.split("/").length === 3
  );
}
