import type { Presentation, PresentationData } from "../entities/presentation";

export interface PresentationRepository {
  listAll(): Promise<Presentation[]>;
  listByProduct(productId: number): Promise<Presentation[]>;
  findById(id: number): Promise<Presentation | null>;
  existsByBarcode(barcode: string, excludeId?: number): Promise<boolean>;
  // Writes the presentation and, in the same transaction, the recalculated
  // units_total of every presentation of the product (a parent's change
  // changes its children). `unitsTotal` is keyed by id; the new row is -1.
  save(
    id: number | null,
    data: PresentationData,
    unitsTotal: Map<number, number>,
  ): Promise<void>;
  setActive(id: number, isActive: boolean): Promise<void>;
}
