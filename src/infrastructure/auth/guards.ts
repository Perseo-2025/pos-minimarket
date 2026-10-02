import { redirect } from "next/navigation";
import { can, homePath, type Permission } from "@/domain/entities/user";
import { UnauthorizedError } from "@/domain/errors";
import { auth } from "./index";

// For server actions and API routes: the logged-in user, if their role has
// the permission (the admin has them all). Throws otherwise.
export async function requirePermission(permission: Permission) {
  const session = await auth();
  if (!session?.user || !can(session.user.role, permission)) {
    throw new UnauthorizedError();
  }
  return session.user;
}

// Same check for API routes that answer 401 instead of throwing.
export async function userWithPermission(permission: Permission) {
  const session = await auth();
  if (!session?.user || !can(session.user.role, permission)) return null;
  return session.user;
}

// Any logged-in user, whatever the role (e.g. marking attendance). Null
// when there is no session.
export async function currentUser() {
  const session = await auth();
  return session?.user ?? null;
}

// For layouts: not logged in → login; wrong role → that role's own screen.
export async function requirePagePermission(permission: Permission) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, permission)) redirect(homePath(session.user.role));
  return session.user;
}
