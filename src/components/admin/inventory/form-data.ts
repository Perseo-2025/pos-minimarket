import { getInventoryUseCase } from "@/application/use-cases/inventory/get-inventory";
import { listAllProductsUseCase } from "@/application/use-cases/products/list-products";
import { listPresentationsUseCase } from "@/application/use-cases/products/save-presentation";
import { listPurchaseOrdersUseCase } from "@/application/use-cases/purchasing/purchase-orders";
import { listSuppliersUseCase } from "@/application/use-cases/suppliers/save-supplier";
import { remainingUnits } from "@/domain/services/purchase-orders";
import {
  inventoryRepository,
  presentationRepository,
  productRepository,
  purchaseOrderRepository,
  supplierRepository,
} from "@/infrastructure/repositories";
import type {
  ReceiptOrderOption,
  ReceiptPresentationOption,
  ReceiptProductOption,
  ReceiptSupplierOption,
} from "./receipt-form";
import type { TransferProductOption } from "./transfer-form";

// Shared by the admin and the warehouse screens.

export async function loadReceiptFormData(): Promise<{
  products: ReceiptProductOption[];
  presentations: ReceiptPresentationOption[];
  suppliers: ReceiptSupplierOption[];
  orders: ReceiptOrderOption[];
}> {
  const [products, presentations, suppliers, orders] = await Promise.all([
    listAllProductsUseCase(productRepository),
    listPresentationsUseCase(presentationRepository),
    listSuppliersUseCase(supplierRepository),
    listPurchaseOrdersUseCase(purchaseOrderRepository),
  ]);
  return {
    products: products
      .filter((p) => p.isActive)
      .map((p) => ({
        id: p.id,
        name: p.name,
        categoryId: p.categoryId,
        tracksExpiry: p.tracksExpiry,
        barcode: p.barcode,
      })),
    presentations: presentations
      .filter((p) => p.isActive)
      .map((p) => ({
        id: p.id,
        productId: p.productId,
        name: p.name,
        unitsTotal: p.unitsTotal,
        barcode: p.barcode,
      })),
    suppliers: suppliers
      .filter((s) => s.isActive)
      .map((s) => ({
        id: s.id,
        name: s.tradeName ?? s.businessName,
        categoryIds: s.categories.map((c) => c.id),
      })),
    orders: orders
      .filter((o) => o.status === "pending" || o.status === "partial")
      .map((o) => ({
        id: o.id,
        supplierId: o.supplierId,
        label:
          `Orden #${o.id} · ${o.supplierName}` +
          (o.status === "partial" ? " (llegó una parte)" : ""),
        lines: openOrderLines(o.lines),
      })),
  };
}

// What is still missing, in the order's presentation when it divides evenly
// (2 Cajas), otherwise in units.
function openOrderLines(
  lines: {
    productId: number;
    presentationId: number | null;
    quantity: number;
    units: number;
    estimatedTotal: number | null;
    receivedUnits: number;
  }[],
): ReceiptOrderOption["lines"] {
  const remaining = remainingUnits(
    new Map(lines.map((l) => [l.productId, l.units])),
    new Map(lines.map((l) => [l.productId, l.receivedUnits])),
  );
  return lines.flatMap((line) => {
    const left = remaining.get(line.productId);
    if (!left) return [];
    const unitsPer = line.units / line.quantity;
    const whole = line.presentationId !== null && left % unitsPer === 0;
    return [
      {
        productId: line.productId,
        presentationId: whole ? line.presentationId : null,
        quantity: whole ? left / unitsPer : left,
        // The quoted cost only applies when the whole line is still due.
        estimatedTotal: left === line.units ? line.estimatedTotal : null,
      },
    ];
  });
}

// Only what is physically in the Almacén can be moved.
export async function loadTransferFormData(): Promise<TransferProductOption[]> {
  const [{ locations, stock }, presentations, products] = await Promise.all([
    getInventoryUseCase(inventoryRepository),
    listPresentationsUseCase(presentationRepository),
    listAllProductsUseCase(productRepository),
  ]);
  const unitCodes = new Map(products.map((p) => [p.id, p.barcode]));
  const warehouseId = locations.find((l) => l.kind === "warehouse")?.id;
  if (warehouseId === undefined) return [];
  return stock
    .filter((s) => s.isActive && (s.byLocation[warehouseId] ?? 0) > 0)
    .map((s) => ({
      id: s.productId,
      name: s.productName,
      available: s.byLocation[warehouseId],
      barcode: unitCodes.get(s.productId) ?? null,
      presentations: presentations
        .filter((p) => p.productId === s.productId && p.isActive)
        .map((p) => ({
          id: p.id,
          name: p.name,
          unitsTotal: p.unitsTotal,
          barcode: p.barcode,
        })),
    }));
}
