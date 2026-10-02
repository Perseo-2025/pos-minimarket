"use server";

import { revalidatePath } from "next/cache";
import { createSaleUseCase } from "@/application/use-cases/sales/create-sale";
import { requirePermission } from "@/infrastructure/auth/guards";
import { saleDeps } from "@/infrastructure/deps";

export async function createSale(input: unknown) {
  const user = await requirePermission("sell");

  const result = await createSaleUseCase(saleDeps, input, user.id);

  revalidatePath("/admin/sales");
  return result;
}
