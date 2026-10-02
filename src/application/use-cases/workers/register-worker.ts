import type { WorkerNameSource } from "@/domain/entities/worker";
import { ValidationError, WorkerAlreadyExistsError } from "@/domain/errors";
import type { AuditRepository } from "@/domain/repositories/audit-repository";
import type { IdentityLookup } from "@/domain/repositories/identity-lookup";
import type { PinHasher } from "@/domain/repositories/pin-hasher";
import type { WorkerRepository } from "@/domain/repositories/worker-repository";
import { workerRegisterSchema } from "@/application/validation/worker";
import { withTimeout } from "./lookup-dni";

// Registered by a cashier at the till (online or queued offline). The worker
// always starts "pending": no discount until an admin approves them.
export async function registerWorkerUseCase(
  deps: {
    workers: WorkerRepository;
    audit: AuditRepository;
    identity: IdentityLookup;
    pinHasher: PinHasher;
  },
  input: unknown,
  actorId: number,
  lookupTimeoutMs: number,
) {
  const data = workerRegisterSchema.parse(input);

  if (!deps.pinHasher.isValidHash(data.pinHash)) {
    throw new ValidationError("La clave no es válida");
  }

  const existing = await deps.workers.findByDni(data.dni);
  if (existing) {
    // Same registration synced twice (offline retry) — already done.
    if (existing.uuid === data.uuid) return { id: existing.id, created: false };
    throw new WorkerAlreadyExistsError(
      `El DNI ${data.dni} ya está registrado a nombre de ${existing.fullName}`,
    );
  }

  // The name is never taken from the client as "verified": when the POS says
  // it came from RENIEC, the server asks again. If it can't confirm, it is
  // stored as manual so the admin reviews it before approving.
  let fullName = data.fullName;
  let nameSource: WorkerNameSource = "manual";
  if (data.nameSource === "api") {
    try {
      const person = await withTimeout(
        deps.identity.lookupDni(data.dni),
        lookupTimeoutMs,
      );
      fullName = person.fullName;
      nameSource = "api";
    } catch {
      nameSource = "manual";
    }
  }

  const workerId = await deps.workers.create({
    uuid: data.uuid,
    dni: data.dni,
    fullName,
    nameSource,
    company: data.company,
    pinHash: data.pinHash,
    registeredById: actorId,
  });

  if (workerId === null) {
    // Lost a race with the same registration sent from another request.
    const worker = await deps.workers.findByDni(data.dni);
    return { id: worker?.id ?? null, created: false };
  }

  await deps.audit.record({
    type: "worker_registered",
    actorId,
    workerId,
    payload: { dni: data.dni, company: data.company, nameSource },
    occurredAt: new Date(data.occurredAt),
  });

  return { id: workerId, created: true };
}
