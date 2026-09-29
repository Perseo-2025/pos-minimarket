import { getOfflineDb } from "./db";
import type { PendingSale } from "./types";

export async function enqueueSale(sale: PendingSale) {
  const db = await getOfflineDb();
  await db.put("pendingSales", sale);
}

export async function listPendingSales() {
  const db = await getOfflineDb();
  return db.getAllFromIndex("pendingSales", "by-created");
}

export async function countPendingSales() {
  const db = await getOfflineDb();
  return db.count("pendingSales");
}

export async function markSaleSynced(id: string) {
  const db = await getOfflineDb();
  await db.delete("pendingSales", id);
}

export async function markSaleStatus(
  id: string,
  status: PendingSale["status"],
  errorMessage?: string,
) {
  const db = await getOfflineDb();
  const sale = await db.get("pendingSales", id);
  if (!sale) return;
  await db.put("pendingSales", { ...sale, status, errorMessage });
}
