import { InvalidImageError } from "@/domain/errors";
import type { ImageStorage } from "@/domain/repositories/image-storage";
import type { ProductRepository } from "@/domain/repositories/product-repository";
import { imageKeyFromUrl } from "./upload-product-image";

// Deletes an upload that was never saved to a product (the admin picked
// another photo or cancelled the form). Images still referenced by a product
// are left alone — those are only removed through updateProductUseCase.
export async function discardProductImageUseCase(
  repos: { products: ProductRepository; images: ImageStorage },
  imageUrl: unknown,
) {
  const key = typeof imageUrl === "string" ? imageKeyFromUrl(imageUrl) : null;
  if (!key) throw new InvalidImageError("Imagen inválida");

  if (await repos.products.isImageInUse(imageUrl as string)) {
    return { deleted: false };
  }

  await repos.images.delete(key);
  return { deleted: true };
}
