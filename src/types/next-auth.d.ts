import type { DefaultSession } from "next-auth";
import type { UserRole } from "@/domain/entities/user";

declare module "next-auth" {
  interface User {
    role: UserRole;
  }

  interface Session {
    // id is users.id_user; Auth.js' own User.id stays a string.
    user: {
      id: number;
      role: UserRole;
    } & Omit<NonNullable<DefaultSession["user"]>, "id">;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: number;
    role: UserRole;
  }
}
