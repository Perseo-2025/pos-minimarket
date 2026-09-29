import type { ProductRepository } from "@/domain/repositories/product-repository";
import { productUpdateSchema } from "@/application/validation/product";

export async function updateProductUseCase(
  repo: ProductRepository,
  input: unknown,
) {
  const data = productUpdateSchema.parse(input);
  await repo.update(data);
}
