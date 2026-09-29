import type { Sale, SaleInput } from "../entities/sale";

export interface SaleRepository {
  // Idempotent: retrying with the same SaleInput.id must not create a
  // duplicate sale or duplicate line items (see the Drizzle implementation).
  insertWithItems(
    input: SaleInput,
    cashierId: string,
  ): Promise<{ id: string; total: number }>;
  findByDateRange(from: Date, to: Date): Promise<Sale[]>;
  findById(id: string): Promise<Sale | null>;
}
