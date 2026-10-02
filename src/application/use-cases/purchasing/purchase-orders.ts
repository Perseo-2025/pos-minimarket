import { ValidationError } from "@/domain/errors";
import type { PresentationRepository } from "@/domain/repositories/presentation-repository";
import type { ProductRepository } from "@/domain/repositories/product-repository";
import type { PurchaseOrderRepository } from "@/domain/repositories/purchase-order-repository";
import type { SupplierRepository } from "@/domain/repositories/supplier-repository";
import { round2 } from "@/domain/value-objects/money";
import { purchaseOrderSchema } from "@/application/validation/purchase-order";

// What the admin asks a supplier for, before it arrives.
export async function createPurchaseOrderUseCase(
  repos: {
    orders: PurchaseOrderRepository;
    suppliers: SupplierRepository;
    products: ProductRepository;
    presentations: PresentationRepository;
  },
  input: unknown,
  actorId: number,
) {
  const data = purchaseOrderSchema.parse(input);
  const supplier = await repos.suppliers.findById(data.supplierId);
  if (!supplier?.isActive) throw new ValidationError("El proveedor no existe o está inactivo");

  // One line per product, so what was ordered and what arrived compare
  // product by product.
  const ids = data.lines.map((line) => line.productId);
  if (new Set(ids).size !== ids.length) {
    throw new ValidationError(
      "Hay un producto repetido en la orden: deja una sola línea por producto",
    );
  }

  const presentations = await repos.presentations.listAll();
  const lines = [];
  for (const [index, line] of data.lines.entries()) {
    const product = await repos.products.findById(line.productId);
    if (!product?.isActive) {
      throw new ValidationError(`Línea ${index + 1}: el producto no existe o está inactivo`);
    }
    let unitsPer = 1;
    if (line.presentationId !== null) {
      const presentation = presentations.find(
        (p) => p.id === line.presentationId && p.productId === product.id,
      );
      if (!presentation?.isActive) {
        throw new ValidationError(`Línea ${index + 1}: presentación no válida para ${product.name}`);
      }
      unitsPer = presentation.unitsTotal;
    }
    lines.push({ ...line, units: line.quantity * unitsPer });
  }

  const known = lines.filter((line) => line.estimatedTotal !== null);
  return repos.orders.create({
    supplierId: supplier.id,
    expectedAt: data.expectedAt,
    note: data.note,
    estimatedTotal:
      known.length === 0
        ? null
        : round2(known.reduce((sum, line) => sum + (line.estimatedTotal ?? 0), 0)),
    lines,
    actorId,
  });
}

// An order that won't come (or was a mistake). Receipts already made stay.
export async function cancelPurchaseOrderUseCase(
  repo: PurchaseOrderRepository,
  id: number,
) {
  const order = await repo.findById(id);
  if (!order) throw new ValidationError("La orden no existe");
  if (order.status === "received" || order.status === "cancelled") {
    throw new ValidationError("Esta orden ya está cerrada");
  }
  await repo.setStatus(id, "cancelled");
}

export function listPurchaseOrdersUseCase(repo: PurchaseOrderRepository) {
  return repo.list(100);
}

export function getPurchaseOrderUseCase(repo: PurchaseOrderRepository, id: number) {
  return repo.findById(id);
}
