import { NextResponse } from "next/server";
import { auth } from "@/infrastructure/auth";

export default auth((req) => {
  const { nextUrl } = req;
  const session = req.auth;
  const role = session?.user?.role;

  const isLoginPage = nextUrl.pathname === "/login";
  const isAdminArea = nextUrl.pathname.startsWith("/admin");
  const isCashierArea = nextUrl.pathname.startsWith("/pos");

  if (!session && (isAdminArea || isCashierArea)) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  if (session && isLoginPage) {
    return NextResponse.redirect(
      new URL(role === "admin" ? "/admin" : "/pos", nextUrl),
    );
  }

  if (session && role === "cashier" && isAdminArea) {
    return NextResponse.redirect(new URL("/pos", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth|api/images|manifest.webmanifest).*)"],
};
