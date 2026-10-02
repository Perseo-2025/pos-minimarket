import type { User, UserRole, UserWithCredentials } from "../entities/user";

export interface CreateUserData {
  name: string;
  username: string;
  passwordHash: string;
  role: UserRole;
}

export interface UserRepository {
  findById(id: number): Promise<User | null>;
  findByUsername(username: string): Promise<UserWithCredentials | null>;
  findAll(): Promise<UserWithCredentials[]>;
  create(data: CreateUserData): Promise<void>;
  setActive(id: number, isActive: boolean): Promise<void>;
}
