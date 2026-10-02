import { ValidationError } from "@/domain/errors";
import type { CategoryRepository } from "@/domain/repositories/category-repository";
import {
  categorySchema,
  categoryUpdateSchema,
} from "@/application/validation/category";

export async function createCategoryUseCase(
  repo: CategoryRepository,
  input: unknown,
) {
  const data = categorySchema.parse(input);
  if (await repo.existsByName(data.name)) {
    throw new ValidationError(`Ya existe la categoría "${data.name}"`);
  }
  await repo.create(data);
}

export async function updateCategoryUseCase(
  repo: CategoryRepository,
  input: unknown,
) {
  const { id, ...data } = categoryUpdateSchema.parse(input);
  if (!(await repo.findById(id))) {
    throw new ValidationError("La categoría no existe");
  }
  if (await repo.existsByName(data.name, id)) {
    throw new ValidationError(`Ya existe la categoría "${data.name}"`);
  }
  await repo.update(id, data);
}

// Categories are never hard-deleted: products and past sales still point at
// them. Deactivating hides the category and its products from the POS.
export async function setCategoryActiveUseCase(
  repo: CategoryRepository,
  id: number,
  isActive: boolean,
) {
  if (!(await repo.findById(id))) {
    throw new ValidationError("La categoría no existe");
  }
  await repo.setActive(id, isActive);
}
