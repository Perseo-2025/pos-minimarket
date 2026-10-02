import type { CategoryRepository } from "@/domain/repositories/category-repository";
import type { PresentationRepository } from "@/domain/repositories/presentation-repository";
import type { ProductRepository } from "@/domain/repositories/product-repository";
import { productCreateSchema } from "@/application/validation/product";
import { ensureBarcodeFree } from "./ensure-barcode";
import { ensureAssignableCategory } from "./ensure-category";

export async function createProductUseCase(
  repos: {
    products: ProductRepository;
    categories: CategoryRepository;
    presentations: PresentationRepository;
  },
  input: unknown,
) {
  const data = productCreateSchema.parse(input);
  await ensureAssignableCategory(repos.categories, data.categoryId);
  await ensureBarcodeFree(repos, data.barcode, {});
  await repos.products.create(data);
}
