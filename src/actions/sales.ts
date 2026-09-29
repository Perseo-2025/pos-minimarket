"use server";

import { revalidatePath } from "next/cache";
import { createSaleUseCase } from "@/application/use-cases/sales/create-sale";
import { UnauthorizedError } from "@/domain/errors";
import { auth } from "@/infrastructure/auth";
import { saleDeps } from "@/infrastructure/deps";

export async function createSale(input: unknown) {
  const session = await auth();
  if (!session?.user || !["admin", "cashier"].includes(session.user.role)) {
    throw new UnauthorizedError();
  }

  const result = await createSaleUseCase(
    saleDeps,
    input,
    session.user.id,
  );

  revalidatePath("/admin/sales");
  return result;
}
