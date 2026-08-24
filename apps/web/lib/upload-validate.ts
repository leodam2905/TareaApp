// Shared image-upload validation. NOTE: SVG is intentionally excluded — it can
// carry inline <script> and is an XSS vector when served.
export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * Confirms the file's leading bytes actually match the claimed image type, so a
 * non-image payload can't be smuggled in with a spoofed content-type header.
 */
export function sniffMatches(buf: Buffer, mime: string): boolean {
  if (buf.length < 12) return false;
  switch (mime) {
    case "image/jpeg":
      return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    case "image/png":
      return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
    case "image/gif":
      return buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38;
    case "image/webp":
      return buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP";
    default:
      return false;
  }
}

/**
 * The real image type, read from the file's leading bytes.
 *
 * Needed because clients lie by omission: an upload with no content type
 * arrives as application/octet-stream, which used to be rejected outright even
 * when the bytes were a perfectly good JPEG. Sniffing is also strictly SAFER
 * than believing the header — the bytes are the thing that gets served.
 */
export function detectImageType(buf: Buffer): string | null {
  for (const mime of Object.keys(ALLOWED_IMAGE_TYPES)) {
    if (sniffMatches(buf, mime)) return mime;
  }
  return null;
}

export interface ImageValidation {
  ok: boolean;
  status?: number;
  error?: string;
  ext?: string;
}

/**
 * Validates a decoded upload buffer: allowed type, real size (not the spoofable
 * File.size), and magic bytes. Returns the server-derived extension on success.
 */
export function validateImageBuffer(mimeType: string, buf: Buffer, maxBytes: number): ImageValidation {
  const ext = ALLOWED_IMAGE_TYPES[mimeType];
  if (!ext) return { ok: false, status: 400, error: "Only JPEG, PNG, WebP, or GIF images allowed" };
  if (buf.byteLength === 0) return { ok: false, status: 400, error: "Empty file" };
  if (buf.byteLength > maxBytes) return { ok: false, status: 413, error: "File too large" };
  if (!sniffMatches(buf, mimeType)) return { ok: false, status: 400, error: "File content does not match its type" };
  return { ok: true, ext };
}
