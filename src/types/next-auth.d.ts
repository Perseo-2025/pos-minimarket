import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role: "admin" | "cashier";
  }

  interface Session {
    user: {
      id: string;
      role: "admin" | "cashier";
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: "admin" | "cashier";
  }
}
