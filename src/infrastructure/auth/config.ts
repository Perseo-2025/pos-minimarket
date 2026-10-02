import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authenticateUserUseCase } from "@/application/use-cases/auth/authenticate-user";
import { userRepository } from "@/infrastructure/repositories";

// No database adapter: sessions are JWTs and login is by credentials, so
// Auth.js never reads the users/accounts/sessions tables itself (and its
// adapter only accepts string ids, while users.id_user is numeric).
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        username: {},
        password: {},
      },
      // Auth.js models user ids as strings; ours is numeric again in the JWT.
      authorize: async (credentials) => {
        const user = await authenticateUserUseCase(userRepository, credentials);
        return user ? { ...user, id: String(user.id) } : null;
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = Number(user.id);
        token.role = user.role;
      }
      // Tokens issued before migration 0008 carry a uuid: sign them out so
      // the next login gets the numeric id.
      if (!Number.isInteger(token.id)) return null;
      return token;
    },
    session: async ({ session, token }) => ({
      ...session,
      user: { ...session.user, id: token.id, role: token.role },
    }),
  },
};
