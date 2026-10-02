"use server";

import { revalidatePath } from "next/cache";
import { createUserUseCase } from "@/application/use-cases/users/create-user";
import { setUserActiveUseCase } from "@/application/use-cases/users/set-user-active";
import { idSchema } from "@/application/validation/id";
import { requirePermission } from "@/infrastructure/auth/guards";
import { userRepository } from "@/infrastructure/repositories";

// The admin panel (the admin role has every permission).
const requireAdmin = () => requirePermission("manage");

export async function createUser(input: unknown) {
  await requireAdmin();
  await createUserUseCase(userRepository, input);

  revalidatePath("/admin/users");
}

export async function setUserActive(id: number, isActive: boolean) {
  await requireAdmin();
  await setUserActiveUseCase(userRepository, idSchema.parse(id), isActive);

  revalidatePath("/admin/users");
}
