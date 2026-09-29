import type { CategoryRepository } from "@/domain/repositories/category-repository";
import type { ProductRepository } from "@/domain/repositories/product-repository";
import { productCreateSchema } from "@/application/validation/product";
import { ensureAssignableCategory } from "./ensure-category";

export async function createProductUseCase(
  repos: { products: ProductRepository; categories: CategoryRepository },
  input: unknown,
) {
  const data = productCreateSchema.parse(input);
  await ensureAssignableCategory(repos.categories, data.categoryId);
  await repos.products.create(data);
}
