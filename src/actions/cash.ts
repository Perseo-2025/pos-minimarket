"use server";

import { revalidatePath } from "next/cache";
import { reviewShiftUseCase } from "@/application/use-cases/cash/cash-shifts";
import { requirePermission } from "@/infrastructure/auth/guards";
import { cashShiftRepository } from "@/infrastructure/repositories";
import { runAction } from "./action-result";

export async function reviewShift(input: unknown) {
  return runAction(async () => {
    const admin = await requirePermission("manage");
    await reviewShiftUseCase(cashShiftRepository, input, admin.id);
    revalidatePath("/admin", "layout");
  });
}
