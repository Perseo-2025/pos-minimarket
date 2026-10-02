import type { CategoryRepository } from "@/domain/repositories/category-repository";
import { ValidationError } from "@/domain/errors";
import type { ImageStorage } from "@/domain/repositories/image-storage";
import type { PresentationRepository } from "@/domain/repositories/presentation-repository";
import type { ProductRepository } from "@/domain/repositories/product-repository";
import { productUpdateSchema } from "@/application/validation/product";
import { ensureBarcodeFree } from "./ensure-barcode";
import { ensureAssignableCategory } from "./ensure-category";
import { imageKeyFromUrl } from "./upload-product-image";

export async function updateProductUseCase(
  repos: {
    products: ProductRepository;
    categories: CategoryRepository;
    presentations: PresentationRepository;
    images: ImageStorage;
  },
  input: unknown,
) {
  const data = productUpdateSchema.parse(input);
  const previous = await repos.products.findById(data.id);
  if (!previous) throw new ValidationError("El producto no existe");
  await ensureAssignableCategory(
    repos.categories,
    data.categoryId,
    previous.categoryId,
  );
  await ensureBarcodeFree(repos, data.barcode, { productId: data.id });

  await repos.products.update(data);

  // imageUrl undefined = "unchanged"; null or a new URL replaces the photo.
  const replaced =
    data.imageUrl !== undefined && data.imageUrl !== previous.imageUrl;
  const oldKey = replaced ? imageKeyFromUrl(previous.imageUrl) : null;
  if (!oldKey) return;
  // Defensive: never delete a file another product still points at.
  if (await repos.products.isImageInUse(previous.imageUrl!)) return;

  // Only after the DB points at the new photo: a failed delete leaves an
  // orphaned file in the bucket, never a product with a broken image.
  try {
    await repos.images.delete(oldKey);
  } catch (error) {
    console.error("Could not delete replaced product image", oldKey, error);
  }
}
