// Helpers for the inline reference image shared by the refine route and client.

// A single-line base64 data URL for a PNG/JPEG/WebP image.
const IMAGE_DATA_URL = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

export function isImageDataUrl(s: string): boolean {
  return IMAGE_DATA_URL.test(s);
}

// ~3 MB of base64 — kept under Vercel's ~4.5 MB function body limit so an oversized
// image yields a clean 400 from us rather than an opaque platform 413. The client
// downscales images well below this before upload.
export const MAX_IMAGE_DATA_URL_CHARS = 4_000_000;
