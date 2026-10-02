import { WORKER_STATUS_LABELS } from "@/domain/entities/worker";
import {
  InvalidPinError,
  PinLockedError,
  WorkerNotActiveError,
  WorkerNotFoundError,
} from "@/domain/errors";
import type { AuditRepository } from "@/domain/repositories/audit-repository";
import type { PinHasher } from "@/domain/repositories/pin-hasher";
import type { WorkerRepository } from "@/domain/repositories/worker-repository";
import { storeDayStart, storeMonthStart } from "@/domain/value-objects/store-time";
import { verifyPinSchema } from "@/application/validation/worker";

export const PIN_MAX_FAILURES = 5;
export const PIN_LOCK_MINUTES = 15;

// Online PIN check at the till. Returns a signed token that the sale carries
// as proof the server saw the right PIN (verification "pin_online").
export async function verifyWorkerPinUseCase(
  deps: {
    workers: WorkerRepository;
    audit: AuditRepository;
    pinHasher: PinHasher;
    issueToken: (workerId: number, cashierId: number) => string;
  },
  input: unknown,
  cashierId: number,
) {
  const data = verifyPinSchema.parse(input);

  const worker = await deps.workers.findByDni(data.dni);
  if (!worker) throw new WorkerNotFoundError("Este DNI no está registrado");
  if (worker.status !== "active") {
    throw new WorkerNotActiveError(
      `El trabajador está ${WORKER_STATUS_LABELS[worker.status].toLowerCase()}`,
    );
  }

  const now = new Date();
  const since = new Date(now.getTime() - PIN_LOCK_MINUTES * 60_000);
  const failures = await deps.audit.countPinFailuresSince(worker.id, since);
  if (failures >= PIN_MAX_FAILURES) throw new PinLockedError(PIN_LOCK_MINUTES);

  if (!(await deps.pinHasher.verify(data.pin, worker.pinHash))) {
    await deps.audit.record({
      type: "worker_pin_failed",
      actorId: cashierId,
      workerId: worker.id,
      payload: { channel: "online" },
      occurredAt: now,
    });
    throw new InvalidPinError(Math.max(0, PIN_MAX_FAILURES - failures - 1));
  }

  const usage = await deps.workers.discountUsage(
    worker.id,
    storeDayStart(now),
    storeMonthStart(now),
  );

  return {
    worker: {
      id: worker.id,
      dni: worker.dni,
      fullName: worker.fullName,
      company: worker.company,
      pointsBalance: worker.pointsBalance,
    },
    usage,
    token: deps.issueToken(worker.id, cashierId),
  };
}
