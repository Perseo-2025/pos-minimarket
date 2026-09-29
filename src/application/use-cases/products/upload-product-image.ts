import { InvalidImageError } from "@/domain/errors";
import type { ImageStorage } from "@/domain/repositories/image-storage";

export const MAX_PRODUCT_IMAGE_BYTES = 2 * 1024 * 1024;

// Images are served back through our own route (see /api/images), so the
// bucket can stay private and the service worker can cache them for offline.
export const PRODUCT_IMAGE_PREFIX = "products/";
export const PRODUCT_IMAGE_URL_BASE = "/api/images/";

const IMAGE_URL_PATTERN =
  /^\/api\/images\/(products\/[0-9a-f-]{36}\.(?:jpg|png|webp))$/;

// Maps a stored imageUrl back to its bucket key; null for anything that
// isn't one of our own uploads (never delete what we didn't create).
export function imageKeyFromUrl(url: string | null | undefined) {
  return url?.match(IMAGE_URL_PATTERN)?.[1] ?? null;
}

const FORMATS = [
  { mime: "image/jpeg", ext: "jpg", magic: [0xff, 0xd8, 0xff] },
  { mime: "image/png", ext: "png", magic: [0x89, 0x50, 0x4e, 0x47] },
  // RIFF....WEBP — checked separately below.
  { mime: "image/webp", ext: "webp", magic: [0x52, 0x49, 0x46, 0x46] },
] as const;

// The client-declared MIME type is untrusted; sniff the real format from the
// file's first bytes so a renamed .exe/.svg can't be stored as an "image".
function detectFormat(bytes: Uint8Array) {
  return FORMATS.find((format) => {
    const matches = format.magic.every((byte, i) => bytes[i] === byte);
    if (!matches) return false;
    if (format.mime !== "image/webp") return true;
    return String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  });
}

export async function uploadProductImageUseCase(
  storage: ImageStorage,
  bytes: Uint8Array,
) {
  if (bytes.byteLength === 0) {
    throw new InvalidImageError("El archivo está vacío");
  }
  if (bytes.byteLength > MAX_PRODUCT_IMAGE_BYTES) {
    throw new InvalidImageError("La imagen supera los 2 MB");
  }

  const format = detectFormat(bytes);
  if (!format) {
    throw new InvalidImageError("Formato no permitido (usa JPG, PNG o WebP)");
  }

  // Random, never-reused keys: the URL can be cached as immutable forever.
  const key = `${PRODUCT_IMAGE_PREFIX}${crypto.randomUUID()}.${format.ext}`;
  await storage.put(key, bytes, format.mime);

  return { key, url: `${PRODUCT_IMAGE_URL_BASE}${key}` };
}
