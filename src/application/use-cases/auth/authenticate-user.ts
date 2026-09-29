import { compare } from "bcryptjs";
import type { AuthenticatedUser } from "@/domain/entities/user";
import type { UserRepository } from "@/domain/repositories/user-repository";
import { loginSchema } from "@/application/validation/user";

export async function authenticateUserUseCase(
  repo: UserRepository,
  credentials: unknown,
): Promise<AuthenticatedUser | null> {
  const parsed = loginSchema.safeParse(credentials);
  if (!parsed.success) return null;

  const user = await repo.findByUsername(parsed.data.username);
  if (!user || !user.isActive) return null;

  const passwordMatches = await compare(
    parsed.data.password,
    user.passwordHash,
  );
  if (!passwordMatches) return null;

  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
  };
}
