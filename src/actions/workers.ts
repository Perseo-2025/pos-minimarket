"use server";

import { revalidatePath } from "next/cache";
import { updateDiscountPolicyUseCase } from "@/application/use-cases/discount/discount-policy";
import { getWorkerStatementUseCase } from "@/application/use-cases/workers/get-worker-statement";
import {
  getWorkerDetailUseCase,
  refreshWorkerNameUseCase,
  setWorkerStatusUseCase,
  updateWorkerBirthDateUseCase,
  type WorkerAction,
} from "@/application/use-cases/workers/manage-workers";
import { idSchema } from "@/application/validation/id";
import { requirePermission } from "@/infrastructure/auth/guards";
import { DNI_LOOKUP_TIMEOUT_MS, workerDeps } from "@/infrastructure/deps";
import { runAction, runDataAction } from "./action-result";

// The admin panel (the admin role has every permission).
const requireAdmin = () => requirePermission("manage");

function revalidateWorkerViews() {
  revalidatePath("/admin/workers");
  revalidatePath("/admin/audit");
}

export async function setWorkerStatus(workerId: number, action: WorkerAction) {
  return runAction(async () => {
    const admin = await requireAdmin();
    await setWorkerStatusUseCase(
      workerDeps,
      idSchema.parse(workerId),
      action,
      admin.id,
    );
    revalidateWorkerViews();
  });
}

export async function refreshWorkerName(workerId: number) {
  return runDataAction(async () => {
    const admin = await requireAdmin();
    const result = await refreshWorkerNameUseCase(
      workerDeps,
      idSchema.parse(workerId),
      admin.id,
      DNI_LOOKUP_TIMEOUT_MS,
    );
    revalidateWorkerViews();
    return result;
  });
}

export async function getWorkerDetail(workerId: number) {
  return runDataAction(async () => {
    await requireAdmin();
    const { worker, purchases } = await getWorkerDetailUseCase(
      workerDeps.workers,
      idSchema.parse(workerId),
    );
    return {
      worker: {
        ...worker,
        approvedAt: worker.approvedAt?.toISOString() ?? null,
        createdAt: worker.createdAt.toISOString(),
      },
      purchases: purchases.map((p) => ({
        ...p,
        clientCreatedAt: p.clientCreatedAt.toISOString(),
      })),
    };
  });
}

export async function updateWorkerBirthDate(workerId: number, birthDate: string) {
  return runAction(async () => {
    const admin = await requireAdmin();
    await updateWorkerBirthDateUseCase(workerDeps, { workerId, birthDate }, admin.id);
    revalidateWorkerViews();
  });
}

export async function updateDiscountPolicy(input: unknown) {
  return runAction(async () => {
    const admin = await requireAdmin();
    await updateDiscountPolicyUseCase(workerDeps, input, admin.id);
    revalidateWorkerViews();
  });
}

// Public: used by the "Mis puntos" page. Authenticated by DNI + birth date,
// with a lockout after several wrong attempts.
export async function getMyPoints(input: unknown) {
  return runDataAction(() => getWorkerStatementUseCase(workerDeps, input));
}
