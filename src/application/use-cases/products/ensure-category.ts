import { ValidationError } from "@/domain/errors";
import type { CategoryRepository } from "@/domain/repositories/category-repository";

// A product can only be moved into an active category. Keeping the category
// it already has is fine even if that one was deactivated meanwhile, so an
// admin can still fix a price without being forced to recategorize.
export async function ensureAssignableCategory(
  categories: CategoryRepository,
  categoryId: number,
  currentCategoryId?: number,
) {
  const category = await categories.findById(categoryId);
  if (!category) throw new ValidationError("La categoría no existe");
  if (!category.isActive && categoryId !== currentCategoryId) {
    throw new ValidationError(`La categoría "${category.name}" está inactiva`);
  }
}
