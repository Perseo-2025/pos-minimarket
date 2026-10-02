// A company (or person) the minimarket buys from. A supplier delivers one or
// more categories and a category can be delivered by several suppliers
// (Bebidas: Backus, AJE, Lindley…), hence a many-to-many relation.
export interface SupplierCategoryRef {
  id: number;
  name: string;
}

export interface Supplier {
  id: number;
  // 11-digit SUNAT RUC; null for small suppliers without one.
  ruc: string | null;
  // Razón social, as on the invoice.
  businessName: string;
  // Nombre comercial / brand the staff knows them by.
  tradeName: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  categories: SupplierCategoryRef[];
}

export interface SupplierData {
  ruc: string | null;
  businessName: string;
  tradeName: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  categoryIds: number[];
}
