import "./load-env";

import { hash } from "bcryptjs";
import { eq, notInArray, sql } from "drizzle-orm";
import { hashPin } from "../security/pin-hash";
import { db } from "./client";
import {
  categories,
  discountPolicies,
  products,
  saleItems,
  users,
  workers,
} from "./schema";

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

const SEED_CATEGORIES = [
  { key: "bebidas", name: "Bebidas", icon: "bebidas", sortOrder: 0 },
  { key: "snacks", name: "Snacks", icon: "snacks", sortOrder: 1 },
  { key: "alimentos", name: "Alimentos", icon: "alimentos", sortOrder: 2 },
  { key: "adornos", name: "Adornos", icon: "adornos", sortOrder: 3 },
] as const;

// Idempotent: existing categories (matched by the lower(name) unique index)
// are kept as-is, so re-running the seed never duplicates or renames them.
async function seedCategories() {
  await db
    .insert(categories)
    .values(
      SEED_CATEGORIES.map(({ name, icon, sortOrder }) => ({
        name,
        icon,
        sortOrder,
      })),
    )
    .onConflictDoNothing();

  const rows = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories);
  const idByName = new Map(rows.map((r) => [r.name.toLowerCase(), r.id]));

  console.log(`Categorías sembradas: ${SEED_CATEGORIES.length}`);
  return Object.fromEntries(
    SEED_CATEGORIES.map((c) => [c.key, idByName.get(c.name.toLowerCase())!]),
  ) as Record<(typeof SEED_CATEGORIES)[number]["key"], string>;
}

async function seedProducts(
  categoryIds: Awaited<ReturnType<typeof seedCategories>>,
) {
  const items = [
    // Bebidas: agua, gaseosa y sus derivados de marca
    { name: "Agua San Luis 625ml", category: "bebidas", priceSale: "2.00" },
    { name: "Inca Kola 500ml", category: "bebidas", priceSale: "3.50" },
    { name: "Coca-Cola 500ml", category: "bebidas", priceSale: "3.50" },
    { name: "Sporade 500ml", category: "bebidas", priceSale: "4.50" },
    { name: "Volt 400ml", category: "bebidas", priceSale: "4.00" },
    { name: "Gatorade 500ml", category: "bebidas", priceSale: "5.00" },
    { name: "Cerveza Pilsen 620ml", category: "bebidas", priceSale: "8.00" },
    // Snacks
    { name: "Papas Lays 45g", category: "snacks", priceSale: "3.00" },
    { name: "Doritos 45g", category: "snacks", priceSale: "3.50" },
    { name: "Chizitos 30g", category: "snacks", priceSale: "1.50" },
    { name: "Galletas Soda Field", category: "snacks", priceSale: "2.00" },
    { name: "Galletas Casino", category: "snacks", priceSale: "1.50" },
    // Alimentos: gelatina, empanada, etc.
    { name: "Gelatina Universal", category: "alimentos", priceSale: "1.50" },
    { name: "Empanada de Pollo", category: "alimentos", priceSale: "4.00" },
    { name: "Empanada de Carne", category: "alimentos", priceSale: "4.00" },
    { name: "Empanada de Queso", category: "alimentos", priceSale: "3.50" },
    { name: "Pie de Manzana", category: "alimentos", priceSale: "5.00" },
    { name: "Sopa Instantánea", category: "alimentos", priceSale: "2.50" },
    // Adornos: taza, recuadros, etc.
    { name: "Taza Decorativa", category: "adornos", priceSale: "12.00" },
    { name: "Recuadro Decorativo", category: "adornos", priceSale: "15.00" },
    { name: "Llavero Souvenir", category: "adornos", priceSale: "6.00" },
    { name: "Peluche Pequeño", category: "adornos", priceSale: "18.00" },
  ] as const;

  const referencedProductIds = db
    .selectDistinct({ productId: saleItems.productId })
    .from(saleItems);

  await db.delete(products).where(
    notInArray(
      products.id,
      sql`(${referencedProductIds})`,
    ),
  );

  await db.insert(products).values(
    items.map(({ category, ...item }) => ({
      ...item,
      categoryId: categoryIds[category],
      isActive: true,
    })),
  );

  console.log(`Productos sembrados: ${items.length}`);
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
    discountPercent: "10.00",
    maxDiscountedSalesPerDay: 2,
    maxDiscountPerMonth: "150.00",
    pointsPerSol: "1.00",
    isActive: true,
  });
  console.log("Política de descuento sembrada: 10%, 2 compras/día, S/ 150/mes, 1 punto por S/ 1");
}

// Two sample airport workers to try the flow from the POS.
async function seedWorkers() {
  const [admin] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, "Admin2026"))
    .limit(1);
  const pinHash = await hashPin("123456");

  await db
    .insert(workers)
    .values([
      {
        dni: "45678912",
        fullName: "JUAN PÉREZ QUISPE",
        nameSource: "api",
        company: "Seguridad Aeroportuaria",
        pinHash,
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
        pinHash,
        status: "pending",
        pendingReason: "new",
        registeredBy: admin?.id,
      },
    ])
    .onConflictDoNothing({ target: workers.dni });

  console.log(
    "Trabajadores del aeropuerto sembrados: 45678912 (activo) y 70112233 (pendiente). Clave de ambos: 123456",
  );
}

async function main() {
  await seedUsers();
  await seedProducts(await seedCategories());
  await seedDiscountPolicy();
  await seedWorkers();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
