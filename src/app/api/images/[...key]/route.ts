import { PRODUCT_IMAGE_PREFIX } from "@/application/use-cases/products/upload-product-image";
import { imageStorage } from "@/infrastructure/storage";

// Streams product images out of the (private) bucket. Only the products/
// prefix is exposed, and keys are validated so this can't be used to read
// arbitrary objects from the bucket.
const KEY_PATTERN = /^products\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/images/[...key]">,
) {
  const key = (await ctx.params).key.join("/");
  if (!key.startsWith(PRODUCT_IMAGE_PREFIX) || !KEY_PATTERN.test(key)) {
    return new Response("Not found", { status: 404 });
  }

  const image = await imageStorage.get(key);
  if (!image) return new Response("Not found", { status: 404 });

  return new Response(image.body, {
    headers: {
      "Content-Type": image.contentType,
      ...(image.contentLength
        ? { "Content-Length": String(image.contentLength) }
        : {}),
      // Keys are random and never overwritten, so the bytes never change.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
