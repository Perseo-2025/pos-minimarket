import "./load-env";

import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "./client";
import { discountPolicies, users, workers } from "./schema";

async function seedUsers() {
  const passwordHash = await hash("password123", 10);

  await db
    .insert(users)
    .values([
      {
        name: "ADMINISTRADOR",
        username: "Admin2026",
        passwordHash,
        role: "admin",
      },
      {
        name: "CAJERO",
        username: "Cajero2026",
        passwordHash,
        role: "cashier",
      },
    ])
    .onConflictDoNothing({ target: users.username });

  console.log(
    "Usuarios sembrados: Admin2026 / Cajero2026. Contraseña para ambos: password123",
  );
}

// Default rule for the airport-worker discount. Only seeded when no policy
// exists, so re-running never overrides what the admin configured.
async function seedDiscountPolicy() {
  const [existing] = await db.select({ id: discountPolicies.id }).from(discountPolicies).limit(1);
  if (existing) {
    console.log("Política de descuento: ya existe, se conserva");
    return;
  }

  await db.insert(discountPolicies).values({
    maxDiscountedUnitsPerSale: 3,
    maxDiscountedSalesPerDay: 2,
    birthdayGiftMaxAmount: "10.00",
    pointsPerSol: "1.00",
    isActive: true,
  });
  console.log(
    "Política de descuento sembrada: 3 unidades/compra, 2 compras/día, regalo hasta S/ 10, 1 punto por S/ 1",
  );
}

// Two sample airport workers to try the flow from the POS.
async function seedWorkers() {
  const [admin] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, "Admin2026"))
    .limit(1);

  await db
    .insert(workers)
    .values([
      {
        dni: "45678912",
        fullName: "JUAN PÉREZ QUISPE",
        nameSource: "api",
        company: "Seguridad Aeroportuaria",
        birthDate: "1990-10-02",
        status: "active",
        pendingReason: null,
        registeredBy: admin?.id,
        approvedBy: admin?.id,
        approvedAt: new Date(),
      },
      {
        dni: "70112233",
        fullName: "ROSA FLORES RAMOS",
        nameSource: "manual",
        company: "LATAM Airlines",
        birthDate: "1995-03-15",
        status: "pending",
        pendingReason: "new",
        registeredBy: admin?.id,
      },
    ])
    .onConflictDoNothing({ target: workers.dni });

  console.log(
    "Trabajadores del aeropuerto sembrados: 45678912 (activo, cumple el 02/10) y 70112233 (pendiente)",
  );
}

// No catalog here: categories and products are registered by the owner from
// the admin panel (the flow starts empty since the 2026-10-01 reset).
async function main() {
  await seedUsers();
  await seedDiscountPolicy();
  await seedWorkers();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
