import { ValidationError } from "@/domain/errors";
import type { CategoryRepository } from "@/domain/repositories/category-repository";
import type { SupplierRepository } from "@/domain/repositories/supplier-repository";
import {
  supplierSchema,
  supplierUpdateSchema,
} from "@/application/validation/supplier";

type Repos = { suppliers: SupplierRepository; categories: CategoryRepository };

async function ensureCategoriesExist(repo: CategoryRepository, ids: number[]) {
  for (const id of new Set(ids)) {
    if (!(await repo.findById(id))) {
      throw new ValidationError("Una de las categorías ya no existe");
    }
  }
}

export function listSuppliersUseCase(repo: SupplierRepository) {
  return repo.findAll();
}

export async function createSupplierUseCase(repos: Repos, input: unknown) {
  const data = supplierSchema.parse(input);
  if (data.ruc && (await repos.suppliers.existsByRuc(data.ruc))) {
    throw new ValidationError(`Ya existe un proveedor con RUC ${data.ruc}`);
  }
  await ensureCategoriesExist(repos.categories, data.categoryIds);
  await repos.suppliers.create(data);
}

export async function updateSupplierUseCase(repos: Repos, input: unknown) {
  const { id, ...data } = supplierUpdateSchema.parse(input);
  if (!(await repos.suppliers.findById(id))) {
    throw new ValidationError("El proveedor no existe");
  }
  if (data.ruc && (await repos.suppliers.existsByRuc(data.ruc, id))) {
    throw new ValidationError(`Ya existe un proveedor con RUC ${data.ruc}`);
  }
  await ensureCategoriesExist(repos.categories, data.categoryIds);
  await repos.suppliers.update(id, data);
}

// Suppliers are never hard-deleted: future purchases will point at them.
export async function setSupplierActiveUseCase(
  repo: SupplierRepository,
  id: number,
  isActive: boolean,
) {
  if (!(await repo.findById(id))) {
    throw new ValidationError("El proveedor no existe");
  }
  await repo.setActive(id, isActive);
}
