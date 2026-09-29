export type UserRole = "admin" | "cashier";

export interface User {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  isActive: boolean;
}

// Includes passwordHash — only the auth use case needs this; never expose
// this type outside the application/infrastructure layers.
export interface UserWithCredentials extends User {
  passwordHash: string;
}

export interface AuthenticatedUser {
  id: string;
  name: string;
  username: string;
  role: UserRole;
}
