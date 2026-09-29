"use server";

import { revalidatePath } from "next/cache";
import { createProductUseCase } from "@/application/use-cases/products/create-product";
import { setProductActiveUseCase } from "@/application/use-cases/products/set-product-active";
import { updateProductUseCase } from "@/application/use-cases/products/update-product";
import { UnauthorizedError } from "@/domain/errors";
import { auth } from "@/infrastructure/auth";
import { productRepository } from "@/infrastructure/repositories";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new UnauthorizedError();
  }
}

export async function createProduct(input: unknown) {
  await requireAdmin();
  await createProductUseCase(productRepository, input);

  revalidatePath("/admin/products");
  revalidatePath("/pos");
}

export async function updateProduct(input: unknown) {
  await requireAdmin();
  await updateProductUseCase(productRepository, input);

  revalidatePath("/admin/products");
  revalidatePath("/pos");
}

export async function deactivateProduct(id: string) {
  await requireAdmin();
  await setProductActiveUseCase(productRepository, id, false);

  revalidatePath("/admin/products");
  revalidatePath("/pos");
}

export async function reactivateProduct(id: string) {
  await requireAdmin();
  await setProductActiveUseCase(productRepository, id, true);

  revalidatePath("/admin/products");
  revalidatePath("/pos");
}
