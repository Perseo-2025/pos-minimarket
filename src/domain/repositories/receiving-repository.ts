import type { DiscrepancyResolution } from "../services/receiving";
import type {
  GoodsReceipt,
  NewGoodsReceipt,
  NewStockTransfer,
  ReceiptDiscrepancy,
  ReceiptDocType,
  StockTransfer,
} from "../entities/receiving";

export interface ReceivingRepository {
  // Into the Almacén, in one transaction: the receipt, its Kardex movements,
  // the dated lots and the products' new average cost.
  createReceipt(data: NewGoodsReceipt): Promise<{ id: number }>;
  documentExists(
    supplierId: number | null,
    docType: ReceiptDocType,
    docNumber: string,
  ): Promise<boolean>;
  listReceipts(limit: number): Promise<GoodsReceipt[]>;
  // Almacén → Tienda. Locks the Almacén balances and refuses to move more
  // than there is (ValidationError).
  createTransfer(data: NewStockTransfer): Promise<{ id: number }>;
  listTransfers(limit: number): Promise<StockTransfer[]>;
  // Open ones first, then the latest resolved.
  listDiscrepancies(limit: number): Promise<ReceiptDiscrepancy[]>;
  findDiscrepancy(id: number): Promise<ReceiptDiscrepancy | null>;
  // Closes it; "replenished" puts the units into the Almacén and "returned"
  // takes the extra units out, in the same transaction.
  resolveDiscrepancy(data: {
    id: number;
    status: DiscrepancyResolution;
    note: string | null;
    expiresAt: string | null;
    actorId: number;
  }): Promise<void>;
}
