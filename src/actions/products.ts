"use server";

import { revalidatePath } from "next/cache";
import { createProductUseCase } from "@/application/use-cases/products/create-product";
import { setProductActiveUseCase } from "@/application/use-cases/products/set-product-active";
import { updateProductUseCase } from "@/application/use-cases/products/update-product";
import { UnauthorizedError } from "@/domain/errors";
import { auth } from "@/infrastructure/auth";
import {
  categoryRepository,
  productRepository,
} from "@/infrastructure/repositories";
import { imageStorage } from "@/infrastructure/storage";
import { runAction } from "./action-result";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new UnauthorizedError();
  }
}

export async function createProduct(input: unknown) {
  return runAction(async () => {
    await requireAdmin();
    await createProductUseCase(
      { products: productRepository, categories: categoryRepository },
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
        images: imageStorage,
      },
      input,
    );

    revalidatePath("/admin/products");
    revalidatePath("/admin/categories");
    revalidatePath("/pos");
  });
}

export async function deactivateProduct(id: string) {
  await requireAdmin();
  await setProductActiveUseCase(productRepository, id, false);

  revalidatePath("/admin/products");
  revalidatePath("/admin/categories");
  revalidatePath("/pos");
}

export async function reactivateProduct(id: string) {
  await requireAdmin();
  await setProductActiveUseCase(productRepository, id, true);

  revalidatePath("/admin/products");
  revalidatePath("/admin/categories");
  revalidatePath("/pos");
}
