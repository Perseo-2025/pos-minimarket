import type { UserRepository } from "@/domain/repositories/user-repository";

export async function setUserActiveUseCase(
  repo: UserRepository,
  id: string,
  isActive: boolean,
) {
  await repo.setActive(id, isActive);
}
