import type { PreparedReceiptLine } from "@/domain/entities/receiving";
import { ValidationError } from "@/domain/errors";
import type { PresentationRepository } from "@/domain/repositories/presentation-repository";
import type { ProductRepository } from "@/domain/repositories/product-repository";
import type { PurchaseOrderRepository } from "@/domain/repositories/purchase-order-repository";
import type { ReceivingRepository } from "@/domain/repositories/receiving-repository";
import { round2 } from "@/domain/value-objects/money";
import {
  receiptDiscrepancy,
  receiptLineUnitCost,
  receiptLineUnits,
} from "@/domain/services/receiving";
import { receiptSchema } from "@/application/validation/receiving";

// Merchandise arriving at the Almacén: every line becomes units (2 Cajas of
// 24 = 48), keeps its expiry date and its cost per unit.
export async function receiveGoodsUseCase(
  repos: {
    receiving: ReceivingRepository;
    products: ProductRepository;
    presentations: PresentationRepository;
    orders: PurchaseOrderRepository;
  },
  input: unknown,
  actorId: number,
) {
  const data = receiptSchema.parse(input);

  // Merchandise answering a purchase order comes from that order's supplier.
  if (data.orderId !== null) {
    const order = await repos.orders.findById(data.orderId);
    if (!order) throw new ValidationError("La orden de compra no existe");
    if (order.status === "cancelled" || order.status === "received") {
      throw new ValidationError(`La orden #${order.id} ya está cerrada`);
    }
    data.supplierId = order.supplierId;
  }

  if (data.docType !== "ninguno" && !data.docNumber) {
    throw new ValidationError("Escribe la serie y número del documento");
  }
  if (
    data.docNumber &&
    (await repos.receiving.documentExists(data.supplierId, data.docType, data.docNumber))
  ) {
    throw new ValidationError(
      `El documento ${data.docNumber} ya fue ingresado. Revisa el historial de ingresos.`,
    );
  }

  const presentations = await repos.presentations.listAll();
  const lines: PreparedReceiptLine[] = [];
  for (const [index, line] of data.lines.entries()) {
    const label = `Línea ${index + 1}`;
    const product = await repos.products.findById(line.productId);
    if (!product) throw new ValidationError(`${label}: el producto no existe`);

    let unitsPerPresentation = 1;
    if (line.presentationId !== null) {
      const presentation = presentations.find(
        (p) => p.id === line.presentationId && p.productId === product.id,
      );
      if (!presentation?.isActive) {
        throw new ValidationError(`${label}: presentación no válida para ${product.name}`);
      }
      unitsPerPresentation = presentation.unitsTotal;
    }
    if (product.tracksExpiry && !line.expiresAt) {
      throw new ValidationError(
        `${label}: ${product.name} vence, escribe su fecha de vencimiento`,
      );
    }
    if (!line.isBonus && line.lineTotal === null) {
      throw new ValidationError(`${label}: escribe cuánto pagaste por ${product.name}`);
    }

    const prepared = {
      quantity: line.quantity,
      unitsPerPresentation,
      lineTotal: line.isBonus ? 0 : (line.lineTotal ?? 0),
      isBonus: line.isBonus,
    };
    const units = receiptLineUnits(prepared);
    const receivedUnits = line.receivedUnits ?? units;
    receiptDiscrepancy(units, receivedUnits);
    lines.push({
      productId: product.id,
      presentationId: line.presentationId,
      quantity: line.quantity,
      units,
      receivedUnits,
      lineTotal: prepared.lineTotal,
      unitCost: receiptLineUnitCost(prepared),
      isBonus: line.isBonus,
      expiresAt: product.tracksExpiry ? line.expiresAt : null,
      captureSource: line.captureSource,
    });
  }

  return repos.receiving.createReceipt({
    supplierId: data.supplierId,
    orderId: data.orderId,
    docType: data.docType,
    docNumber: data.docNumber,
    note: data.note,
    total: round2(lines.reduce((sum, line) => sum + line.lineTotal, 0)),
    lines,
    actorId,
  });
}

export function listReceiptsUseCase(repo: ReceivingRepository) {
  return repo.listReceipts(100);
}
