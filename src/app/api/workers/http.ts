import { NextResponse } from "next/server";
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
import { auth } from "@/infrastructure/auth";

// Only logged-in staff (cashier/admin) may use the worker endpoints.
export async function requireStaff() {
  const session = await auth();
  if (!session?.user || !["admin", "cashier"].includes(session.user.role)) {
    return null;
  }
  return session.user;
}

export function unauthorized() {
  return NextResponse.json({ error: "Sesión no válida" }, { status: 401 });
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

// Centralized mapping of domain errors to HTTP. `code` lets the POS react
// (e.g. show remaining attempts) without parsing messages.
export function workerErrorResponse(error: unknown) {
  if (error instanceof InvalidPinError) {
    return NextResponse.json(
      { code: "invalid_pin", error: error.message, attemptsLeft: error.attemptsLeft },
      { status: 422 },
    );
  }
  if (error instanceof PinLockedError) {
    return NextResponse.json(
      { code: "locked", error: error.message, minutes: error.minutes },
      { status: 423 },
    );
  }
  if (error instanceof WorkerNotFoundError) {
    return NextResponse.json({ code: "not_found", error: error.message }, { status: 404 });
  }
  if (error instanceof WorkerNotActiveError) {
    return NextResponse.json({ code: "not_active", error: error.message }, { status: 409 });
  }
  if (error instanceof WorkerAlreadyExistsError) {
    return NextResponse.json({ code: "duplicate", error: error.message }, { status: 409 });
  }
  if (error instanceof ValidationError) {
    return NextResponse.json({ code: "invalid", error: error.message }, { status: 400 });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { code: "invalid", error: error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }
  if (error instanceof UnauthorizedError) return unauthorized();

  console.error("Worker request failed", error);
  return NextResponse.json(
    { code: "server", error: "Error del servidor" },
    { status: 500 },
  );
}
