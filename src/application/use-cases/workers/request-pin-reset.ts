import {
  ValidationError,
  WorkerNotActiveError,
  WorkerNotFoundError,
} from "@/domain/errors";
import type { AuditRepository } from "@/domain/repositories/audit-repository";
import type { PinHasher } from "@/domain/repositories/pin-hasher";
import type { WorkerRepository } from "@/domain/repositories/worker-repository";
import { pinResetSchema } from "@/application/validation/worker";

// "Forgot PIN" at the till. The worker types a new PIN, but the discount stays
// off until an admin re-approves them: otherwise a cashier could reset a PIN
// to one they know and use the worker's discount freely.
export async function requestPinResetUseCase(
  deps: { workers: WorkerRepository; audit: AuditRepository; pinHasher: PinHasher },
  input: unknown,
  actorId: number,
) {
  const data = pinResetSchema.parse(input);

  if (!deps.pinHasher.isValidHash(data.pinHash)) {
    throw new ValidationError("La clave no es válida");
  }

  const worker = await deps.workers.findById(data.workerId);
  if (!worker) throw new WorkerNotFoundError();
  if (worker.status === "rejected") {
    throw new WorkerNotActiveError("Este trabajador fue rechazado");
  }

  await deps.workers.replacePin(worker.id, data.pinHash);
  // Keyed by the client op uuid: a retried sync doesn't log it twice.
  await deps.audit.recordWithUuid(data.uuid, {
    type: "worker_pin_reset_requested",
    actorId,
    workerId: worker.id,
    payload: { previousStatus: worker.status },
    occurredAt: new Date(data.occurredAt),
  });
}
