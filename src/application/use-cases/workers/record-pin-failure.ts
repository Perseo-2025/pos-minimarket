import type { AuditRepository } from "@/domain/repositories/audit-repository";
import type { WorkerRepository } from "@/domain/repositories/worker-repository";
import { pinFailureSchema } from "@/application/validation/worker";

// Wrong PINs typed while offline are queued on the device and reported here,
// so trying PINs without internet still leaves a trace.
export async function recordPinFailureUseCase(
  deps: { workers: WorkerRepository; audit: AuditRepository },
  input: unknown,
  actorId: number,
) {
  const data = pinFailureSchema.parse(input);

  const worker = await deps.workers.findById(data.workerId);
  if (!worker) return;

  await deps.audit.recordWithUuid(data.uuid, {
    type: "worker_pin_failed",
    actorId,
    workerId: worker.id,
    payload: { channel: "offline" },
    occurredAt: new Date(data.occurredAt),
  });
}
