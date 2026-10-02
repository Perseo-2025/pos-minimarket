import { ValidationError } from "@/domain/errors";
import type { InventoryRepository } from "@/domain/repositories/inventory-repository";
import type { PresentationRepository } from "@/domain/repositories/presentation-repository";
import type { ReceivingRepository } from "@/domain/repositories/receiving-repository";
import { checkTransfer } from "@/domain/services/receiving";
import { aggregateQuantities } from "@/domain/services/stock-count";
import { mergeCaptureSources } from "@/domain/value-objects/capture-source";
import { transferSchema } from "@/application/validation/receiving";

// Almacén → Tienda: from then on the product shows up at the till.
export async function transferStockUseCase(
  repos: {
    receiving: ReceivingRepository;
    inventory: InventoryRepository;
    presentations: PresentationRepository;
  },
  input: unknown,
  actorId: number,
) {
  const data = transferSchema.parse(input);
  const [presentations, locations, stock] = await Promise.all([
    repos.presentations.listAll(),
    repos.inventory.listLocations(),
    repos.inventory.listStock(),
  ]);
  const warehouse = locations.find((l) => l.kind === "warehouse");
  if (!warehouse) throw new ValidationError("No hay un Almacén configurado");

  // Presentations to units (1 Display = 24), then one total per product.
  const units = data.lines.map((line) => {
    if (line.presentationId === null) {
      return { productId: line.productId, quantity: line.quantity };
    }
    const presentation = presentations.find(
      (p) => p.id === line.presentationId && p.productId === line.productId,
    );
    if (!presentation?.isActive) {
      throw new ValidationError("Una de las presentaciones no es válida");
    }
    return {
      productId: line.productId,
      quantity: line.quantity * presentation.unitsTotal,
    };
  });
  const totals = aggregateQuantities(units);

  // Friendly check by name first; the repository checks again under lock.
  for (const [productId, requested] of totals) {
    const product = stock.find((s) => s.productId === productId);
    if (!product) throw new ValidationError("Uno de los productos no existe");
    try {
      checkTransfer(product.byLocation[warehouse.id] ?? 0, requested);
    } catch (error) {
      throw new ValidationError(`${product.productName}: ${(error as Error).message}`);
    }
  }

  return repos.receiving.createTransfer({
    lines: [...totals].map(([productId, quantity]) => ({
      productId,
      units: quantity,
      captureSource: mergeCaptureSources(
        data.lines.filter((l) => l.productId === productId).map((l) => l.captureSource),
      ),
    })),
    note: data.note,
    actorId,
  });
}

export function listTransfersUseCase(repo: ReceivingRepository) {
  return repo.listTransfers(100);
}
