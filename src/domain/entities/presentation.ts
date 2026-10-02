// A bulk packaging of a product, e.g. "Caja = 6 Displays = 144 units".
// See computeUnitsTotal() in domain/services/presentations.ts.
export interface Presentation {
  id: number;
  productId: number;
  name: string;
  // null = contains units directly.
  parentId: number | null;
  parentName: string | null;
  qtyOfParent: number;
  unitsTotal: number;
  barcode: string | null;
  isActive: boolean;
}

export interface PresentationData {
  productId: number;
  name: string;
  parentId: number | null;
  qtyOfParent: number;
  barcode: string | null;
}
