"use server";

import { revalidatePath } from "next/cache";
import {
  createCategoryUseCase,
  setCategoryActiveUseCase,
  updateCategoryUseCase,
} from "@/application/use-cases/categories/save-category";
import { UnauthorizedError } from "@/domain/errors";
import { auth } from "@/infrastructure/auth";
import { categoryRepository } from "@/infrastructure/repositories";
import { runAction } from "./action-result";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new UnauthorizedError();
  }
}

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

export async function setCategoryActive(id: string, isActive: boolean) {
  return runAction(async () => {
    await requireAdmin();
    await setCategoryActiveUseCase(categoryRepository, id, isActive);
    revalidateCategoryViews();
  });
}
