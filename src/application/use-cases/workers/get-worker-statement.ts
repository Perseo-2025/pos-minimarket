import { InvalidWorkerCredentialsError, TooManyAttemptsError } from "@/domain/errors";
import type { AuditRepository } from "@/domain/repositories/audit-repository";
import type { WorkerRepository } from "@/domain/repositories/worker-repository";
import { workerStatementSchema } from "@/application/validation/worker";

export const STATEMENT_MAX_FAILURES = 5;
export const STATEMENT_LOCK_MINUTES = 15;

// Public "Mis puntos" page: the worker checks their balance and purchases.
// This turns every worker into an auditor — a purchase they didn't make is a
// red flag they can report. They prove who they are with DNI + birth date;
// wrong attempts lock the DNI for a while, and errors never reveal whether a
// DNI is registered.
export async function getWorkerStatementUseCase(
  deps: { workers: WorkerRepository; audit: AuditRepository },
  input: unknown,
) {
  const data = workerStatementSchema.parse(input);
  const genericError = new InvalidWorkerCredentialsError();

  const worker = await deps.workers.findByDni(data.dni);
  if (!worker || worker.status === "rejected") throw genericError;

  const now = new Date();
  const since = new Date(now.getTime() - STATEMENT_LOCK_MINUTES * 60_000);
  if (
    (await deps.audit.countStatementFailuresSince(worker.id, since)) >=
    STATEMENT_MAX_FAILURES
  ) {
    throw new TooManyAttemptsError(STATEMENT_LOCK_MINUTES);
  }

  if (worker.birthDate === null || worker.birthDate !== data.birthDate) {
    await deps.audit.record({
      type: "worker_statement_failed",
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
      giftTotal: p.giftTotal,
      total: p.total,
      pointsEarned: p.pointsEarned,
    })),
  };
}

export type WorkerStatement = Awaited<ReturnType<typeof getWorkerStatementUseCase>>;
