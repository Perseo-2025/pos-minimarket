import type { DiscountPolicyRepository } from "@/domain/repositories/discount-policy-repository";
import type { WorkerRepository } from "@/domain/repositories/worker-repository";
import { storeDayStart, storeYearStart } from "@/domain/value-objects/store-time";

// Everything the POS needs to identify workers and price their discount
// without internet: workers (with their birth dates for the gift), their
// usage of the limits, and the active policy.
export async function getWorkerSnapshotUseCase(deps: {
  workers: WorkerRepository;
  policies: DiscountPolicyRepository;
}) {
  const now = new Date();
  const [workers, policy] = await Promise.all([
    deps.workers.offlineSnapshot(storeDayStart(now), storeYearStart(now)),
    deps.policies.getActive(),
  ]);

  return {
    generatedAt: now.toISOString(),
    policy: policy && {
      id: policy.id,
      maxDiscountedUnitsPerSale: policy.maxDiscountedUnitsPerSale,
      maxDiscountedSalesPerDay: policy.maxDiscountedSalesPerDay,
      pointsPerSol: policy.pointsPerSol,
      birthdayGiftMaxAmount: policy.birthdayGiftMaxAmount,
    },
    workers,
  };
}

export type WorkerSnapshot = Awaited<ReturnType<typeof getWorkerSnapshotUseCase>>;
