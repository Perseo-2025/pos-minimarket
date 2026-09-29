import { asc, eq } from "drizzle-orm";
import type { UserWithCredentials } from "@/domain/entities/user";
import type {
  CreateUserData,
  UserRepository,
} from "@/domain/repositories/user-repository";
import { db } from "@/infrastructure/db/client";
import { users } from "@/infrastructure/db/schema";

function toUser(row: typeof users.$inferSelect): UserWithCredentials {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    role: row.role,
    isActive: row.isActive,
    passwordHash: row.passwordHash,
  };
}

export class DrizzleUserRepository implements UserRepository {
  async findByUsername(username: string): Promise<UserWithCredentials | null> {
    const [row] = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    return row ? toUser(row) : null;
  }

  async findAll(): Promise<UserWithCredentials[]> {
    const rows = await db.select().from(users).orderBy(asc(users.name));
    return rows.map(toUser);
  }

  async create(data: CreateUserData): Promise<void> {
    await db.insert(users).values({
      name: data.name,
      username: data.username,
      passwordHash: data.passwordHash,
      role: data.role,
    });
  }

  async setActive(id: string, isActive: boolean): Promise<void> {
    await db
      .update(users)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(users.id, id));
  }
}
