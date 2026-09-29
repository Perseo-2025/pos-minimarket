import type { ProductRepository } from "@/domain/repositories/product-repository";

export async function setProductActiveUseCase(
  repo: ProductRepository,
  id: string,
  isActive: boolean,
) {
  await repo.setActive(id, isActive);
}
