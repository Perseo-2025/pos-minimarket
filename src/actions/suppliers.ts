"use server";

import { revalidatePath } from "next/cache";
import {
  createSupplierUseCase,
  setSupplierActiveUseCase,
  updateSupplierUseCase,
} from "@/application/use-cases/suppliers/save-supplier";
import { idSchema } from "@/application/validation/id";
import { requirePermission } from "@/infrastructure/auth/guards";
import {
  categoryRepository,
  supplierRepository,
} from "@/infrastructure/repositories";
import { runAction } from "./action-result";

// The admin panel (the admin role has every permission).
const requireAdmin = () => requirePermission("manage");

const repos = { suppliers: supplierRepository, categories: categoryRepository };

// The categories page lists each category's suppliers too.
function revalidateSupplierViews() {
  revalidatePath("/admin/suppliers");
  revalidatePath("/admin/categories");
}

export async function createSupplier(input: unknown) {
  return runAction(async () => {
    await requireAdmin();
    await createSupplierUseCase(repos, input);
    revalidateSupplierViews();
  });
}

export async function updateSupplier(input: unknown) {
  return runAction(async () => {
    await requireAdmin();
    await updateSupplierUseCase(repos, input);
    revalidateSupplierViews();
  });
}

export async function setSupplierActive(id: number, isActive: boolean) {
  return runAction(async () => {
    await requireAdmin();
    await setSupplierActiveUseCase(
      supplierRepository,
      idSchema.parse(id),
      isActive,
    );
    revalidateSupplierViews();
  });
}
