import { ZodError } from "zod";
import {
  InvalidPinError,
  PinLockedError,
  UnauthorizedError,
  ValidationError,
  WorkerAlreadyExistsError,
  WorkerNotActiveError,
  WorkerNotFoundError,
} from "@/domain/errors";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type DataResult<T> = { ok: true; data: T } | { ok: false; error: string };

// Domain errors whose messages are written for the end user.
const USER_FACING_ERRORS = [
  ValidationError,
  WorkerNotFoundError,
  WorkerNotActiveError,
  WorkerAlreadyExistsError,
  InvalidPinError,
  PinLockedError,
];

function toFailure(error: unknown): { ok: false; error: string } {
  if (USER_FACING_ERRORS.some((type) => error instanceof type)) {
    return { ok: false, error: (error as Error).message };
  }
  if (error instanceof ZodError) {
    return {
      ok: false,
      error: error.issues[0]?.message ?? "Datos inválidos",
    };
  }
  if (error instanceof UnauthorizedError) {
    return { ok: false, error: "No tienes permiso para esta acción" };
  }
  throw error;
}

// Next.js redacts messages of errors thrown from Server Actions in
// production, so expected failures are returned as data the form can show.
// Anything unexpected is still thrown (and logged by Next).
export async function runAction(fn: () => Promise<void>): Promise<ActionResult> {
  try {
    await fn();
    return { ok: true };
  } catch (error) {
    return toFailure(error);
  }
}

export async function runDataAction<T>(fn: () => Promise<T>): Promise<DataResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    return toFailure(error);
  }
}
