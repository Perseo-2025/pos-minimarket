import type { WorkerStatus } from "@/domain/entities/worker";
import { DniNotFoundError } from "@/domain/errors";
import type { IdentityLookup } from "@/domain/repositories/identity-lookup";
import type { WorkerRepository } from "@/domain/repositories/worker-repository";
import { dniSchema } from "@/application/validation/worker";

export type DniLookupResult =
  | { status: "found"; fullName: string }
  | { status: "registered"; fullName: string; workerStatus: WorkerStatus }
  | { status: "not_found" }
  | { status: "unavailable" };

// Runs a promise with a deadline; a slow provider must never hold the till.
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

// Never throws for provider problems: "not_found"/"unavailable" tell the POS
// to let the cashier type the name manually.
export async function lookupDniUseCase(
  deps: { identity: IdentityLookup; workers: WorkerRepository },
  input: unknown,
  timeoutMs: number,
): Promise<DniLookupResult> {
  const dni = dniSchema.parse(input);

  const existing = await deps.workers.findByDni(dni);
  if (existing) {
    return {
      status: "registered",
      fullName: existing.fullName,
      workerStatus: existing.status,
    };
  }

  try {
    const person = await withTimeout(deps.identity.lookupDni(dni), timeoutMs);
    return { status: "found", fullName: person.fullName };
  } catch (error) {
    if (error instanceof DniNotFoundError) return { status: "not_found" };
    return { status: "unavailable" };
  }
}
