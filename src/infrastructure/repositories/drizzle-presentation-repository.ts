import { and, asc, eq, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type {
  Presentation,
  PresentationData,
} from "@/domain/entities/presentation";
import type { PresentationRepository } from "@/domain/repositories/presentation-repository";
import { db } from "@/infrastructure/db/client";
import { productPresentations } from "@/infrastructure/db/schema";

const parent = alias(productPresentations, "parent");

function selectPresentations() {
  return db
    .select({ presentation: productPresentations, parentName: parent.name })
    .from(productPresentations)
    .leftJoin(parent, eq(parent.id, productPresentations.parentId));
}

type Row = Awaited<ReturnType<typeof selectPresentations>>[number];

function toPresentation({ presentation: p, parentName }: Row): Presentation {
  return {
    id: p.id,
    productId: p.productId,
    name: p.name,
    parentId: p.parentId,
    parentName,
    qtyOfParent: p.qtyOfParent,
    unitsTotal: p.unitsTotal,
    barcode: p.barcode,
    isActive: p.isActive,
  };
}

// Smallest first: Display (24) before Caja (144).
const order = [
  asc(productPresentations.productId),
  asc(productPresentations.unitsTotal),
  asc(productPresentations.name),
];

export class DrizzlePresentationRepository implements PresentationRepository {
  async listAll() {
    return (await selectPresentations().orderBy(...order)).map(toPresentation);
  }

  async listByProduct(productId: number) {
    const rows = await selectPresentations()
      .where(eq(productPresentations.productId, productId))
      .orderBy(...order);
    return rows.map(toPresentation);
  }

  async findById(id: number) {
    const [row] = await selectPresentations()
      .where(eq(productPresentations.id, id))
      .limit(1);
    return row ? toPresentation(row) : null;
  }

  async existsByBarcode(barcode: string, excludeId?: number) {
    const sameCode = eq(productPresentations.barcode, barcode);
    const [row] = await db
      .select({ id: productPresentations.id })
      .from(productPresentations)
      .where(
        excludeId ? and(sameCode, ne(productPresentations.id, excludeId)) : sameCode,
      )
      .limit(1);
    return row !== undefined;
  }

  async save(
    id: number | null,
    data: PresentationData,
    unitsTotal: Map<number, number>,
  ) {
    await db.transaction(async (tx) => {
      const now = new Date();
      if (id === null) {
        await tx.insert(productPresentations).values({
          ...data,
          unitsTotal: unitsTotal.get(-1)!,
        });
      } else {
        await tx
          .update(productPresentations)
          .set({ ...data, unitsTotal: unitsTotal.get(id)!, updatedAt: now })
          .where(eq(productPresentations.id, id));
      }
      // Children of the edited presentation change too.
      for (const [otherId, units] of unitsTotal) {
        if (otherId === -1 || otherId === id) continue;
        await tx
          .update(productPresentations)
          .set({ unitsTotal: units })
          .where(
            and(
              eq(productPresentations.id, otherId),
              ne(productPresentations.unitsTotal, units),
            ),
          );
      }
    });
  }

  async setActive(id: number, isActive: boolean) {
    await db
      .update(productPresentations)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(productPresentations.id, id));
  }
}
