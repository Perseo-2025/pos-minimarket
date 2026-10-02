import { desc, eq } from "drizzle-orm";
import type {
  DiscountPolicy,
  DiscountPolicyData,
} from "@/domain/entities/discount-policy";
import type { DiscountPolicyRepository } from "@/domain/repositories/discount-policy-repository";
import { db } from "@/infrastructure/db/client";
import { discountPolicies, users } from "@/infrastructure/db/schema";

type PolicyRow = typeof discountPolicies.$inferSelect;

function toPolicy(row: PolicyRow, createdByName: string | null = null): DiscountPolicy {
  return {
    id: row.id,
    maxDiscountedUnitsPerSale: row.maxDiscountedUnitsPerSale,
    maxDiscountedSalesPerDay: row.maxDiscountedSalesPerDay,
    pointsPerSol: Number(row.pointsPerSol),
    birthdayGiftMaxAmount: Number(row.birthdayGiftMaxAmount),
    isActive: row.isActive,
    createdById: row.createdBy,
    createdByName,
    createdAt: row.createdAt,
  };
}

export class DrizzleDiscountPolicyRepository implements DiscountPolicyRepository {
  async getActive() {
    const [row] = await db
      .select()
      .from(discountPolicies)
      .where(eq(discountPolicies.isActive, true))
      .orderBy(desc(discountPolicies.createdAt))
      .limit(1);
    return row ? toPolicy(row) : null;
  }

  async findById(id: number) {
    const [row] = await db
      .select()
      .from(discountPolicies)
      .where(eq(discountPolicies.id, id))
      .limit(1);
    return row ? toPolicy(row) : null;
  }

  async listVersions(limit: number) {
    const rows = await db
      .select({ policy: discountPolicies, createdByName: users.name })
      .from(discountPolicies)
      .leftJoin(users, eq(discountPolicies.createdBy, users.id))
      .orderBy(desc(discountPolicies.createdAt))
      .limit(limit);
    return rows.map((row) => toPolicy(row.policy, row.createdByName));
  }

  async createVersion(data: DiscountPolicyData, actorId: number) {
    return db.transaction(async (tx) => {
      await tx
        .update(discountPolicies)
        .set({ isActive: false })
        .where(eq(discountPolicies.isActive, true));

      const [row] = await tx
        .insert(discountPolicies)
        .values({
          maxDiscountedUnitsPerSale: data.maxDiscountedUnitsPerSale,
          maxDiscountedSalesPerDay: data.maxDiscountedSalesPerDay,
          pointsPerSol: data.pointsPerSol.toFixed(2),
          birthdayGiftMaxAmount: data.birthdayGiftMaxAmount.toFixed(2),
          isActive: true,
          createdBy: actorId,
        })
        .returning();

      return toPolicy(row);
    });
  }
}
