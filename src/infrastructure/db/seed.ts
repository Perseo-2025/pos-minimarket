import "./load-env";

import { hash } from "bcryptjs";
import { notInArray, sql } from "drizzle-orm";
import { db } from "./client";
import { products, saleItems, users } from "./schema";

async function seedUsers() {
  const passwordHash = await hash("password123", 10);

  await db
    .insert(users)
    .values([
      {
        name: "Admin Tienda",
        username: "Admin2026",
        passwordHash,
        role: "admin",
      },
      {
        name: "Cajero Tienda",
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

async function seedProducts() {
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

  await db.insert(products).values(items.map((item) => ({ ...item, isActive: true })));

  console.log(`Productos sembrados: ${items.length}`);
}

async function main() {
  await seedUsers();
  await seedProducts();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
