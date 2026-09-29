"use server";

import { revalidatePath } from "next/cache";
import { createSaleUseCase } from "@/application/use-cases/sales/create-sale";
import { UnauthorizedError } from "@/domain/errors";
import { auth } from "@/infrastructure/auth";
import { saleRepository } from "@/infrastructure/repositories";

export async function createSale(input: unknown) {
  const session = await auth();
  if (!session?.user || !["admin", "cashier"].includes(session.user.role)) {
    throw new UnauthorizedError();
  }

  const result = await createSaleUseCase(saleRepository, input, session.user.id);

  revalidatePath("/admin/sales");
  return result;
}
