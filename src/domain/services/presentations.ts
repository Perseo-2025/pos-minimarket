import { ValidationError } from "../errors";

// How a product is bought/moved in bulk: "Display = 24 units", "Caja = 6
// displays". A presentation contains `qtyOfParent` of its parent, or of the
// unit when it has no parent. Stock is always kept in units; the POS only
// ever sells the unit.
export interface PresentationNode {
  id: number;
  parentId: number | null;
  qtyOfParent: number;
}

// Units in each presentation, following the chain down to the unit
// (Caja → 6 Display → 24 Unidad = 144). Rejects cycles and parents that
// don't belong to the same product.
export function computeUnitsTotal(
  presentations: PresentationNode[],
): Map<number, number> {
  const byId = new Map(presentations.map((p) => [p.id, p]));
  const units = new Map<number, number>();

  function resolve(id: number, path: Set<number>): number {
    const known = units.get(id);
    if (known !== undefined) return known;
    if (path.has(id)) {
      throw new ValidationError(
        "Una presentación no puede contenerse a sí misma (directa o indirectamente)",
      );
    }
    const node = byId.get(id);
    if (!node) throw new ValidationError("La presentación contenedora no existe");
    if (!Number.isInteger(node.qtyOfParent) || node.qtyOfParent < 2) {
      throw new ValidationError("Una presentación debe contener al menos 2");
    }
    path.add(id);
    const parentUnits =
      node.parentId === null ? 1 : resolve(node.parentId, path);
    path.delete(id);
    const total = node.qtyOfParent * parentUnits;
    units.set(id, total);
    return total;
  }

  for (const p of presentations) resolve(p.id, new Set());
  return units;
}

// "3 Cajas" of Mentitas → 432 units.
export function toUnits(quantity: number, unitsTotal: number) {
  return quantity * unitsTotal;
}
