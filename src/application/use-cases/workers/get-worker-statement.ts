import { InvalidPinError, PinLockedError } from "@/domain/errors";
import type { AuditRepository } from "@/domain/repositories/audit-repository";
import type { PinHasher } from "@/domain/repositories/pin-hasher";
import type { WorkerRepository } from "@/domain/repositories/worker-repository";
import { verifyPinSchema } from "@/application/validation/worker";
import { PIN_LOCK_MINUTES, PIN_MAX_FAILURES } from "./verify-worker-pin";

// Public "Mis puntos" page: the worker checks their balance and purchases.
// This turns every worker into an auditor — a purchase they didn't make is a
// red flag they can report. Wrong PINs count toward the same lockout as the
// till, and errors never reveal whether a DNI is registered.
export async function getWorkerStatementUseCase(
  deps: { workers: WorkerRepository; audit: AuditRepository; pinHasher: PinHasher },
  input: unknown,
) {
  const data = verifyPinSchema.parse(input);
  const genericError = new InvalidPinError(0, "DNI o clave incorrectos");

  const worker = await deps.workers.findByDni(data.dni);
  if (!worker || worker.status === "rejected") throw genericError;

  const now = new Date();
  const since = new Date(now.getTime() - PIN_LOCK_MINUTES * 60_000);
  if ((await deps.audit.countPinFailuresSince(worker.id, since)) >= PIN_MAX_FAILURES) {
    throw new PinLockedError(PIN_LOCK_MINUTES);
  }

  if (!(await deps.pinHasher.verify(data.pin, worker.pinHash))) {
    await deps.audit.record({
      type: "worker_pin_failed",
      actorId: null,
      workerId: worker.id,
      payload: { channel: "mis-puntos" },
      occurredAt: now,
    });
    throw genericError;
  }

  return {
    fullName: worker.fullName,
    company: worker.company,
    status: worker.status,
    pointsBalance: worker.pointsBalance,
    purchases: (await deps.workers.purchaseHistory(worker.id, 20)).map((p) => ({
      saleId: p.saleId,
      clientCreatedAt: p.clientCreatedAt.toISOString(),
      subtotal: p.subtotal,
      discountTotal: p.discountTotal,
      total: p.total,
      pointsEarned: p.pointsEarned,
    })),
  };
}

export type WorkerStatement = Awaited<ReturnType<typeof getWorkerStatementUseCase>>;
