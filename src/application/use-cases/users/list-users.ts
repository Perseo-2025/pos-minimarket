import type { UserRepository } from "@/domain/repositories/user-repository";

export async function listUsersUseCase(repo: UserRepository) {
  return repo.findAll();
}
