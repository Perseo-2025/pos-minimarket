"use server";

import { revalidatePath } from "next/cache";
import { updateDiscountPolicyUseCase } from "@/application/use-cases/discount/discount-policy";
import { getWorkerStatementUseCase } from "@/application/use-cases/workers/get-worker-statement";
import {
  getWorkerDetailUseCase,
  refreshWorkerNameUseCase,
  setWorkerStatusUseCase,
  type WorkerAction,
} from "@/application/use-cases/workers/manage-workers";
import { UnauthorizedError } from "@/domain/errors";
import { auth } from "@/infrastructure/auth";
import { DNI_LOOKUP_TIMEOUT_MS, workerDeps } from "@/infrastructure/deps";
import { runAction, runDataAction } from "./action-result";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new UnauthorizedError();
  }
  return session.user;
}

function revalidateWorkerViews() {
  revalidatePath("/admin/workers");
  revalidatePath("/admin/audit");
}

export async function setWorkerStatus(workerId: string, action: WorkerAction) {
  return runAction(async () => {
    const admin = await requireAdmin();
    await setWorkerStatusUseCase(workerDeps, workerId, action, admin.id);
    revalidateWorkerViews();
  });
}

export async function refreshWorkerName(workerId: string) {
  return runDataAction(async () => {
    const admin = await requireAdmin();
    const result = await refreshWorkerNameUseCase(
      workerDeps,
      workerId,
      admin.id,
      DNI_LOOKUP_TIMEOUT_MS,
    );
    revalidateWorkerViews();
    return result;
  });
}

export async function getWorkerDetail(workerId: string) {
  return runDataAction(async () => {
    await requireAdmin();
    const { worker, purchases } = await getWorkerDetailUseCase(
      workerDeps.workers,
      workerId,
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

export async function updateDiscountPolicy(input: unknown) {
  return runAction(async () => {
    const admin = await requireAdmin();
    await updateDiscountPolicyUseCase(workerDeps, input, admin.id);
    revalidateWorkerViews();
  });
}

// Public: used by the "Mis puntos" page. Authenticated by DNI + PIN, with the
// same lockout as the till.
export async function getMyPoints(input: unknown) {
  return runDataAction(() => getWorkerStatementUseCase(workerDeps, input));
}
