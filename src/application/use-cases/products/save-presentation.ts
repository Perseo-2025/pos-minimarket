import { ValidationError } from "@/domain/errors";
import type { PresentationRepository } from "@/domain/repositories/presentation-repository";
import type { ProductRepository } from "@/domain/repositories/product-repository";
import { computeUnitsTotal } from "@/domain/services/presentations";
import {
  presentationSchema,
  presentationUpdateSchema,
} from "@/application/validation/presentation";
import { ensureBarcodeFree } from "./ensure-barcode";

type Repos = {
  presentations: PresentationRepository;
  products: ProductRepository;
};

export function listPresentationsUseCase(repo: PresentationRepository) {
  return repo.listAll();
}

// The new presentation's id inside unitsTotal, before it has a real one.
const NEW_ID = -1;

async function save(repos: Repos, id: number | null, input: unknown) {
  const data = id
    ? presentationUpdateSchema.parse({ ...(input as object), id })
    : presentationSchema.parse(input);

  if (!(await repos.products.findById(data.productId))) {
    throw new ValidationError("El producto no existe");
  }
  if (data.name.toLowerCase() === "unidad") {
    throw new ValidationError("La unidad ya existe: es lo que se vende en caja");
  }

  const siblings = await repos.presentations.listByProduct(data.productId);
  const current = id ? siblings.find((p) => p.id === id) : null;
  if (id && !current) throw new ValidationError("La presentación no existe");

  const sameName = siblings.find(
    (p) => p.id !== id && p.name.toLowerCase() === data.name.toLowerCase(),
  );
  if (sameName) {
    throw new ValidationError(`Ya existe la presentación "${sameName.name}"`);
  }
  if (data.parentId !== null) {
    const parent = siblings.find((p) => p.id === data.parentId);
    if (!parent) {
      throw new ValidationError("La presentación contenedora no es de este producto");
    }
    if (!parent.isActive) {
      throw new ValidationError(`"${parent.name}" está desactivada`);
    }
  }
  await ensureBarcodeFree(repos, data.barcode, { presentationId: id ?? undefined });

  // Recalculate the whole product: changing a Display changes its Cajas.
  const myId = id ?? NEW_ID;
  const unitsTotal = computeUnitsTotal([
    ...siblings
      .filter((p) => p.id !== myId)
      .map((p) => ({ id: p.id, parentId: p.parentId, qtyOfParent: p.qtyOfParent })),
    { id: myId, parentId: data.parentId, qtyOfParent: data.qtyOfParent },
  ]);

  await repos.presentations.save(id, data, unitsTotal);
}

export function createPresentationUseCase(repos: Repos, input: unknown) {
  return save(repos, null, input);
}

export function updatePresentationUseCase(repos: Repos, id: number, input: unknown) {
  return save(repos, id, input);
}

// Never deleted: receipts and transfers will point at presentations.
export async function setPresentationActiveUseCase(
  repo: PresentationRepository,
  id: number,
  isActive: boolean,
) {
  const presentation = await repo.findById(id);
  if (!presentation) throw new ValidationError("La presentación no existe");
  const siblings = await repo.listByProduct(presentation.productId);

  if (!isActive) {
    const child = siblings.find((p) => p.parentId === id && p.isActive);
    if (child) {
      throw new ValidationError(
        `Primero desactiva "${child.name}", que contiene ${presentation.name}`,
      );
    }
  } else if (presentation.parentId !== null) {
    const parent = siblings.find((p) => p.id === presentation.parentId);
    if (parent && !parent.isActive) {
      throw new ValidationError(`Primero activa "${parent.name}"`);
    }
  }
  await repo.setActive(id, isActive);
}
