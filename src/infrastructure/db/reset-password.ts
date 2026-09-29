import "./load-env";

import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "./client";
import { users } from "./schema";

// Usage: pnpm db:reset-password <username> <new-password>
// Also reactivates the user, so a locked-out admin can always get back in.
async function main() {
  const [username, password] = process.argv.slice(2);
  if (!username || !password || password.length < 6) {
    console.error(
      "Uso: pnpm db:reset-password <usuario> <nueva-contraseña (mín. 6)>",
    );
    process.exit(1);
  }

  const updated = await db
    .update(users)
    .set({
      passwordHash: await hash(password, 10),
      isActive: true,
      updatedAt: new Date(),
    })
    .where(eq(users.username, username))
    .returning({ username: users.username });

  if (updated.length === 0) {
    console.error(`No existe el usuario "${username}"`);
    process.exit(1);
  }

  console.log(`Contraseña de ${username} restablecida.`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
