export type UserRole = "admin" | "cashier" | "warehouse";

export const USER_ROLES: UserRole[] = ["admin", "cashier", "warehouse"];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrador",
  cashier: "Cajero",
  warehouse: "Almacenero",
};

export const USER_ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: "Puede hacer todo: administrar, vender en caja y trabajar en el almacén.",
  cashier: "Solo vende en caja.",
  warehouse: "Ingresa mercadería al Almacén y la traslada a la Tienda.",
};

// What each area of the system needs:
// - manage: admin panel (catalog, users, reports)
// - sell:   the till
// - stock:  receiving goods and moving them to the shop floor
export type Permission = "manage" | "sell" | "stock";

// Business rule: the admin can do everything; the other roles are optional,
// for when the owner wants to separate people and screens.
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: ["manage", "sell", "stock"],
  cashier: ["sell"],
  warehouse: ["stock"],
};

export function can(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

// Where each role lands after logging in.
export function homePath(role: UserRole): string {
  if (role === "admin") return "/admin";
  if (role === "warehouse") return "/almacen";
  return "/pos";
}

export interface User {
  id: number;
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
  id: number;
  name: string;
  username: string;
  role: UserRole;
}
