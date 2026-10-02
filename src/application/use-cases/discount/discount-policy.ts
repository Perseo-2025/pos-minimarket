import type { AuditRepository } from "@/domain/repositories/audit-repository";
import type { DiscountPolicyRepository } from "@/domain/repositories/discount-policy-repository";
import { discountPolicySchema } from "@/application/validation/worker";

export async function getDiscountPolicyOverviewUseCase(repo: DiscountPolicyRepository) {
  const versions = await repo.listVersions(10);
  return { active: versions.find((v) => v.isActive) ?? null, versions };
}

// A change never edits the current rule: it creates a new version, so past
// sales keep pointing at the rule they were charged under.
export async function updateDiscountPolicyUseCase(
  deps: { policies: DiscountPolicyRepository; audit: AuditRepository },
  input: unknown,
  actorId: number,
) {
  const data = discountPolicySchema.parse(input);
  const previous = await deps.policies.getActive();
  const created = await deps.policies.createVersion(data, actorId);

  await deps.audit.record({
    type: "policy_changed",
    actorId,
    payload: {
      from: previous && {
        maxDiscountedUnitsPerSale: previous.maxDiscountedUnitsPerSale,
        maxDiscountedSalesPerDay: previous.maxDiscountedSalesPerDay,
        pointsPerSol: previous.pointsPerSol,
        birthdayGiftMaxAmount: previous.birthdayGiftMaxAmount,
      },
      to: data,
      policyId: created.id,
    },
    occurredAt: new Date(),
  });

  return created;
}
