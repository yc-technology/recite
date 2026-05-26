// Helpers for the inline reference image shared by the refine route and client.

// A single-line base64 data URL for a PNG/JPEG/WebP image.
const IMAGE_DATA_URL = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

export function isImageDataUrl(s: string): boolean {
  return IMAGE_DATA_URL.test(s);
}

// ~7.5 MB decoded — a backstop on the inline image payload sent to the model.
export const MAX_IMAGE_DATA_URL_CHARS = 10_000_000;
