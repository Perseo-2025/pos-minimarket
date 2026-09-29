import type { CategoryRepository } from "@/domain/repositories/category-repository";

export function listCategoriesWithCountsUseCase(repo: CategoryRepository) {
  return repo.findAllWithCounts();
}

export function listActiveCategoriesUseCase(repo: CategoryRepository) {
  return repo.findActive();
}
