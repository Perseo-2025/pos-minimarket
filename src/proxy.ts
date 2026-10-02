import { NextResponse } from "next/server";
import { can, homePath, type Permission } from "@/domain/entities/user";
import { auth } from "@/infrastructure/auth";

// Which permission each area needs (see ROLE_PERMISSIONS: the admin has all).
function requiredPermission(pathname: string): Permission | null {
  if (pathname.startsWith("/admin")) return "manage";
  if (pathname.startsWith("/pos")) return "sell";
  if (pathname.startsWith("/almacen")) return "stock";
  return null;
}

export default auth((req) => {
  const { nextUrl } = req;
  const user = req.auth?.user;
  const required = requiredPermission(nextUrl.pathname);

  if (!user && required) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  if (user && nextUrl.pathname === "/login") {
    return NextResponse.redirect(new URL(homePath(user.role), nextUrl));
  }

  // Wrong area for this role: back to its own screen.
  if (user && required && !can(user.role, required)) {
    return NextResponse.redirect(new URL(homePath(user.role), nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth|api/images|manifest.webmanifest).*)"],
};
