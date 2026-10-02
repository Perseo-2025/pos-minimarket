"use server";

import { revalidatePath } from "next/cache";
import {
  createCategoryUseCase,
  setCategoryActiveUseCase,
  updateCategoryUseCase,
} from "@/application/use-cases/categories/save-category";
import { idSchema } from "@/application/validation/id";
import { requirePermission } from "@/infrastructure/auth/guards";
import { categoryRepository } from "@/infrastructure/repositories";
import { runAction } from "./action-result";

// The admin panel (the admin role has every permission).
const requireAdmin = () => requirePermission("manage");

// Categories show up in the admin lists and drive the POS sidebar.
function revalidateCategoryViews() {
  revalidatePath("/admin/categories");
  revalidatePath("/admin/products");
  revalidatePath("/pos");
}

export async function createCategory(input: unknown) {
  return runAction(async () => {
    await requireAdmin();
    await createCategoryUseCase(categoryRepository, input);
    revalidateCategoryViews();
  });
}

export async function updateCategory(input: unknown) {
  return runAction(async () => {
    await requireAdmin();
    await updateCategoryUseCase(categoryRepository, input);
    revalidateCategoryViews();
  });
}

export async function setCategoryActive(id: number, isActive: boolean) {
  return runAction(async () => {
    await requireAdmin();
    await setCategoryActiveUseCase(
      categoryRepository,
      idSchema.parse(id),
      isActive,
    );
    revalidateCategoryViews();
  });
}
