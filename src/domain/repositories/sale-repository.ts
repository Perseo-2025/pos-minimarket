import type { Sale, SaleRecord } from "../entities/sale";

export interface SaleRepository {
  // Idempotent: retrying with the same SaleRecord.id must not create a
  // duplicate sale, duplicate line items or award loyalty points twice
  // (see the Drizzle implementation). `inserted` is false on a retry.
  insertWithItems(
    record: SaleRecord,
  ): Promise<{ id: string; total: number; inserted: boolean }>;
  exists(id: string): Promise<boolean>;
  findByDateRange(from: Date, to: Date): Promise<Sale[]>;
  findById(id: string): Promise<Sale | null>;
}
