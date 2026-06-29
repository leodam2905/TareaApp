// Cloudinary delivery helper.
//
// Injects `f_auto,q_auto` (auto format + auto quality, which also strips
// metadata) into a Cloudinary delivery URL so images/videos are served
// optimized instead of as-is. Safe to call on any string:
//   - Non-Cloudinary URLs (blob:, data:, Google/GitHub avatars, …) pass through.
//   - URLs that already carry an f_auto / q_auto transform are left unchanged.
// This runs at delivery time, so it also optimizes URLs already stored in the DB.

const DELIVERY_RE = /(https?:\/\/res\.cloudinary\.com\/[^/]+\/(?:image|video)\/upload)\/(.*)$/;

export function cld(url: string | null | undefined): string {
  if (!url) return url ?? "";
  const m = url.match(DELIVERY_RE);
  if (!m) return url; // not a Cloudinary delivery URL — leave it alone
  const [, prefix, rest] = m;
  if (/(^|,)(f_auto|q_auto)(,|$|\/)/.test(rest)) return url; // already optimized
  return `${prefix}/f_auto,q_auto/${rest}`;
}
