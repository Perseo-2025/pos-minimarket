"use server";

import { revalidatePath } from "next/cache";
import { createProductUseCase } from "@/application/use-cases/products/create-product";
import {
  createPresentationUseCase,
  setPresentationActiveUseCase,
  updatePresentationUseCase,
} from "@/application/use-cases/products/save-presentation";
import { setProductActiveUseCase } from "@/application/use-cases/products/set-product-active";
import { updateProductUseCase } from "@/application/use-cases/products/update-product";
import { idSchema } from "@/application/validation/id";
import { requirePermission } from "@/infrastructure/auth/guards";
import {
  categoryRepository,
  presentationRepository,
  productRepository,
} from "@/infrastructure/repositories";
import { imageStorage } from "@/infrastructure/storage";
import { runAction } from "./action-result";

// The admin panel (the admin role has every permission).
const requireAdmin = () => requirePermission("manage");

export async function createProduct(input: unknown) {
  return runAction(async () => {
    await requireAdmin();
    await createProductUseCase(
      {
        products: productRepository,
        categories: categoryRepository,
        presentations: presentationRepository,
      },
      input,
    );

    revalidatePath("/admin/products");
    revalidatePath("/admin/categories");
    revalidatePath("/pos");
  });
}

export async function updateProduct(input: unknown) {
  return runAction(async () => {
    await requireAdmin();
    await updateProductUseCase(
      {
        products: productRepository,
        categories: categoryRepository,
        presentations: presentationRepository,
        images: imageStorage,
      },
      input,
    );

    revalidatePath("/admin/products");
    revalidatePath("/admin/categories");
    revalidatePath("/pos");
  });
}

// ids come from the client: validated before reaching the use case.
export async function deactivateProduct(id: number) {
  await requireAdmin();
  await setProductActiveUseCase(productRepository, idSchema.parse(id), false);

  revalidatePath("/admin/products");
  revalidatePath("/admin/categories");
  revalidatePath("/pos");
}

export async function reactivateProduct(id: number) {
  await requireAdmin();
  await setProductActiveUseCase(productRepository, idSchema.parse(id), true);

  revalidatePath("/admin/products");
  revalidatePath("/admin/categories");
  revalidatePath("/pos");
}

const presentationRepos = {
  presentations: presentationRepository,
  products: productRepository,
};

export async function createPresentation(input: unknown) {
  return runAction(async () => {
    await requireAdmin();
    await createPresentationUseCase(presentationRepos, input);
    revalidatePath("/admin/products");
  });
}

export async function updatePresentation(id: number, input: unknown) {
  return runAction(async () => {
    await requireAdmin();
    await updatePresentationUseCase(presentationRepos, idSchema.parse(id), input);
    revalidatePath("/admin/products");
  });
}

export async function setPresentationActive(id: number, isActive: boolean) {
  return runAction(async () => {
    await requireAdmin();
    await setPresentationActiveUseCase(
      presentationRepository,
      idSchema.parse(id),
      isActive,
    );
    revalidatePath("/admin/products");
  });
}
