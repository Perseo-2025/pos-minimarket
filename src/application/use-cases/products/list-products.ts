import type { ProductRepository } from "@/domain/repositories/product-repository";

// The POS catalog: only what was moved to the Tienda and still has units.
export async function listSellableProductsUseCase(repo: ProductRepository) {
  return repo.findSellable();
}

export async function listAllProductsUseCase(repo: ProductRepository) {
  return repo.findAll();
}
