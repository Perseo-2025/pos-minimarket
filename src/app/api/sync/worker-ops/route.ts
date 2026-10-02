import { NextResponse } from "next/server";
import { registerWorkerUseCase } from "@/application/use-cases/workers/register-worker";
import { DNI_LOOKUP_TIMEOUT_MS, workerDeps } from "@/infrastructure/deps";
import {
  readJson,
  requireStaff,
  unauthorized,
  workerErrorResponse,
} from "../../workers/http";

// Worker operations made at the till — sent right away when online, or
// queued in IndexedDB and replayed here by the sync engine. All idempotent.
export async function POST(request: Request) {
  const user = await requireStaff();
  if (!user) return unauthorized();

  const body = (await readJson(request)) as { op?: string; data?: unknown } | null;

  try {
    const data = body?.data;
    switch (body?.op) {
      case "register":
        return NextResponse.json(
          await registerWorkerUseCase(
            workerDeps,
            data,
            user.id,
            DNI_LOOKUP_TIMEOUT_MS,
          ),
        );
      // Queued by older versions of the POS (workers had a PIN then): there
      // is nothing left to record, so they are dropped from the queue.
      case "pin_reset":
      case "pin_failed":
        return NextResponse.json({ ok: true });
      default:
        return NextResponse.json(
          { code: "invalid", error: "Operación desconocida" },
          { status: 400 },
        );
    }
  } catch (error) {
    return workerErrorResponse(error);
  }
}
