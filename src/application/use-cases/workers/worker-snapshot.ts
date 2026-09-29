import type { DiscountPolicyRepository } from "@/domain/repositories/discount-policy-repository";
import type { WorkerRepository } from "@/domain/repositories/worker-repository";
import { storeDayStart, storeMonthStart } from "@/domain/value-objects/store-time";

// Everything the POS needs to identify workers and price their discount
// without internet: workers (hashes for active ones only), their usage of
// the caps, and the active policy.
export async function getWorkerSnapshotUseCase(deps: {
  workers: WorkerRepository;
  policies: DiscountPolicyRepository;
}) {
  const now = new Date();
  const [workers, policy] = await Promise.all([
    deps.workers.offlineSnapshot(storeDayStart(now), storeMonthStart(now)),
    deps.policies.getActive(),
  ]);

  return {
    generatedAt: now.toISOString(),
    policy: policy && {
      id: policy.id,
      discountPercent: policy.discountPercent,
      maxDiscountedSalesPerDay: policy.maxDiscountedSalesPerDay,
      maxDiscountPerMonth: policy.maxDiscountPerMonth,
      pointsPerSol: policy.pointsPerSol,
    },
    workers,
  };
}

export type WorkerSnapshot = Awaited<ReturnType<typeof getWorkerSnapshotUseCase>>;
