import { NextResponse } from "next/server";
import { recordPinFailureUseCase } from "@/application/use-cases/workers/record-pin-failure";
import { registerWorkerUseCase } from "@/application/use-cases/workers/register-worker";
import { requestPinResetUseCase } from "@/application/use-cases/workers/request-pin-reset";
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
      case "pin_reset":
        await requestPinResetUseCase(workerDeps, data, user.id);
        return NextResponse.json({ ok: true });
      case "pin_failed":
        await recordPinFailureUseCase(workerDeps, data, user.id);
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
