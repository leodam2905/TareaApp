// Cloudflare R2 storage helper (S3-compatible).
//
// Replaces Cloudinary: images are resized/optimized with `sharp` at upload time
// (Cloudinary did this via transform URLs), then stored in R2 and served from the
// public bucket URL. PDFs (verification docs) are uploaded as-is.
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

const accountId = process.env.R2_ACCOUNT_ID;
const bucket = process.env.R2_BUCKET || "tarea-media";
const publicUrl = (process.env.R2_PUBLIC_URL || "").replace(/\/+$/, "");

export function r2Configured(): boolean {
  return !!(accountId && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && publicUrl);
}

let _client: S3Client | null = null;
function client(): S3Client {
  if (!_client) {
    _client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return _client;
}

const IMMUTABLE = "public, max-age=31536000, immutable";

export type Resize =
  | { fit: "inside"; width: number; height: number }  // contain within box, never upscale
  | { fit: "cover"; width: number; height: number };   // crop to fill exactly

/**
 * Resize + re-encode an image to WebP (strips metadata) and upload to R2.
 * `key` should be a bucket path without extension (e.g. "avatars/abc-123").
 * Returns the public delivery URL.
 */
export async function uploadImageToR2(
  buffer: Buffer,
  opts: { key: string; resize?: Resize; quality?: number }
): Promise<string> {
  const resize = opts.resize ?? { fit: "inside", width: 1600, height: 1600 };
  const pipeline = sharp(buffer).rotate(); // honor EXIF orientation
  if (resize.fit === "inside") {
    pipeline.resize(resize.width, resize.height, { fit: "inside", withoutEnlargement: true });
  } else {
    pipeline.resize(resize.width, resize.height, { fit: "cover", position: "centre" });
  }
  const out = await pipeline.webp({ quality: opts.quality ?? 82 }).toBuffer();
  const key = opts.key.replace(/^\/+/, "") + ".webp";

  await client().send(new PutObjectCommand({
    Bucket: bucket, Key: key, Body: out, ContentType: "image/webp", CacheControl: IMMUTABLE,
  }));
  return `${publicUrl}/${key}`;
}

/** Upload a raw file (e.g. a PDF) to R2 without image processing. */
export async function uploadRawToR2(
  buffer: Buffer,
  opts: { key: string; contentType: string }
): Promise<string> {
  const key = opts.key.replace(/^\/+/, "");
  await client().send(new PutObjectCommand({
    Bucket: bucket, Key: key, Body: buffer, ContentType: opts.contentType, CacheControl: IMMUTABLE,
  }));
  return `${publicUrl}/${key}`;
}

/** Short random suffix so each upload gets a unique, cache-immutable key. */
export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
