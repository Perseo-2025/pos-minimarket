"use server";

import { revalidatePath } from "next/cache";
import { createUserUseCase } from "@/application/use-cases/users/create-user";
import { setUserActiveUseCase } from "@/application/use-cases/users/set-user-active";
import { UnauthorizedError } from "@/domain/errors";
import { auth } from "@/infrastructure/auth";
import { userRepository } from "@/infrastructure/repositories";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new UnauthorizedError();
  }
}

export async function createUser(input: unknown) {
  await requireAdmin();
  await createUserUseCase(userRepository, input);

  revalidatePath("/admin/users");
}

export async function setUserActive(id: string, isActive: boolean) {
  await requireAdmin();
  await setUserActiveUseCase(userRepository, id, isActive);

  revalidatePath("/admin/users");
}
