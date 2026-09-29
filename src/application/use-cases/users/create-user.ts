import { hash } from "bcryptjs";
import type { UserRepository } from "@/domain/repositories/user-repository";
import { userCreateSchema } from "@/application/validation/user";

export async function createUserUseCase(repo: UserRepository, input: unknown) {
  const data = userCreateSchema.parse(input);
  const passwordHash = await hash(data.password, 10);

  await repo.create({
    name: data.name,
    username: data.username,
    passwordHash,
    role: data.role,
  });
}
