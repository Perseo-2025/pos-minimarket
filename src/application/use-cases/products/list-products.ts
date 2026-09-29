import type { ProductRepository } from "@/domain/repositories/product-repository";

export async function listActiveProductsUseCase(repo: ProductRepository) {
  return repo.findActive();
}

export async function listAllProductsUseCase(repo: ProductRepository) {
  return repo.findAll();
}
