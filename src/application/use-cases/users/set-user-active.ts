import type { UserRepository } from "@/domain/repositories/user-repository";

export async function setUserActiveUseCase(
  repo: UserRepository,
  id: number,
  isActive: boolean,
) {
  await repo.setActive(id, isActive);
}
