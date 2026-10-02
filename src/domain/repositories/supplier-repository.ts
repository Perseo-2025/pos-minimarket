import type { Supplier, SupplierData } from "../entities/supplier";

export interface SupplierRepository {
  findAll(): Promise<Supplier[]>;
  findById(id: number): Promise<Supplier | null>;
  // excludeId lets an update keep its own RUC.
  existsByRuc(ruc: string, excludeId?: number): Promise<boolean>;
  // Supplier and its categories are written together.
  create(data: SupplierData): Promise<void>;
  update(id: number, data: SupplierData): Promise<void>;
  setActive(id: number, isActive: boolean): Promise<void>;
}
