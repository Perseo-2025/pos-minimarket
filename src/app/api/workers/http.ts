import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
  WorkerAlreadyExistsError,
  WorkerNotActiveError,
  WorkerNotFoundError,
} from "@/domain/errors";
import { userWithPermission } from "@/infrastructure/auth/guards";

// The worker endpoints serve the till: whoever can sell.
export function requireStaff() {
  return userWithPermission("sell");
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
// (e.g. a duplicate DNI) without parsing messages.
export function workerErrorResponse(error: unknown) {
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
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ code: "forbidden", error: error.message }, { status: 403 });
  }

  console.error("Worker request failed", error);
  return NextResponse.json(
    { code: "server", error: "Error del servidor" },
    { status: 500 },
  );
}
