import type { ProductRepository } from "@/domain/repositories/product-repository";
import { productCreateSchema } from "@/application/validation/product";

export async function createProductUseCase(
  repo: ProductRepository,
  input: unknown,
) {
  const data = productCreateSchema.parse(input);
  await repo.create(data);
}
