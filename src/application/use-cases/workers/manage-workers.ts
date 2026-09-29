import type { AuditEventType } from "@/domain/entities/audit";
import { type WorkerStatus, withoutPin } from "@/domain/entities/worker";
import { ValidationError, WorkerNotFoundError } from "@/domain/errors";
import type { AuditRepository } from "@/domain/repositories/audit-repository";
import type { IdentityLookup } from "@/domain/repositories/identity-lookup";
import type { WorkerRepository } from "@/domain/repositories/worker-repository";
import { withTimeout } from "./lookup-dni";

export type WorkerAction = "approve" | "reject" | "suspend" | "reactivate";

// Allowed transitions: only these keep the audit trail meaningful.
const TRANSITIONS: Record<
  WorkerAction,
  { from: WorkerStatus[]; to: WorkerStatus; event: AuditEventType }
> = {
  approve: { from: ["pending"], to: "active", event: "worker_approved" },
  reject: { from: ["pending"], to: "rejected", event: "worker_rejected" },
  suspend: { from: ["active", "pending"], to: "suspended", event: "worker_suspended" },
  reactivate: { from: ["suspended"], to: "active", event: "worker_reactivated" },
};

export async function listWorkersUseCase(
  repo: WorkerRepository,
  status?: WorkerStatus,
) {
  const [workers, counts] = await Promise.all([
    repo.findAll(status),
    repo.countByStatus(),
  ]);
  return { workers, counts };
}

export async function getWorkerDetailUseCase(repo: WorkerRepository, id: string) {
  const worker = await repo.findById(id);
  if (!worker) throw new WorkerNotFoundError();
  return { worker: withoutPin(worker), purchases: await repo.purchaseHistory(id, 30) };
}

export async function setWorkerStatusUseCase(
  deps: { workers: WorkerRepository; audit: AuditRepository },
  workerId: string,
  action: WorkerAction,
  actorId: string,
) {
  const transition = TRANSITIONS[action];
  if (!transition) throw new ValidationError("Acción no válida");

  const worker = await deps.workers.findById(workerId);
  if (!worker) throw new WorkerNotFoundError();
  if (!transition.from.includes(worker.status)) {
    throw new ValidationError("El trabajador ya cambió de estado. Recarga la página.");
  }

  await deps.workers.setStatus(worker.id, transition.to, actorId);
  await deps.audit.record({
    type: transition.event,
    actorId,
    workerId: worker.id,
    payload: {
      from: worker.status,
      to: transition.to,
      pendingReason: worker.pendingReason,
    },
    occurredAt: new Date(),
  });
}

// Admin re-checks a manually typed name against RENIEC and adopts it.
export async function refreshWorkerNameUseCase(
  deps: { workers: WorkerRepository; audit: AuditRepository; identity: IdentityLookup },
  workerId: string,
  actorId: string,
  timeoutMs: number,
) {
  const worker = await deps.workers.findById(workerId);
  if (!worker) throw new WorkerNotFoundError();

  let fullName: string;
  try {
    fullName = (await withTimeout(deps.identity.lookupDni(worker.dni), timeoutMs))
      .fullName;
  } catch {
    throw new ValidationError(
      "No se pudo consultar RENIEC en este momento. Intenta más tarde.",
    );
  }

  await deps.workers.updateName(worker.id, fullName, "api");
  await deps.audit.record({
    type: "worker_name_updated",
    actorId,
    workerId: worker.id,
    payload: { from: worker.fullName, to: fullName },
    occurredAt: new Date(),
  });

  return { fullName, changed: fullName !== worker.fullName };
}
