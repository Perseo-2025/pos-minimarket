import type { UserRole, UserWithCredentials } from "../entities/user";

export interface CreateUserData {
  name: string;
  username: string;
  passwordHash: string;
  role: UserRole;
}

export interface UserRepository {
  findByUsername(username: string): Promise<UserWithCredentials | null>;
  findAll(): Promise<UserWithCredentials[]>;
  create(data: CreateUserData): Promise<void>;
  setActive(id: string, isActive: boolean): Promise<void>;
}
