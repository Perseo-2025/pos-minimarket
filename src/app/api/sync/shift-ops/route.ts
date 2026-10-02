import { NextResponse } from "next/server";
import {
  closeShiftUseCase,
  openShiftUseCase,
  recordCashMovementUseCase,
} from "@/application/use-cases/cash/cash-shifts";
import { userWithPermission } from "@/infrastructure/auth/guards";
import { cashShiftRepository } from "@/infrastructure/repositories";
import {
  readJson,
  unauthorized,
  workerErrorResponse,
} from "../../workers/http";

// Till shift operations ("Abrir caja", money in/out, "Cerrar caja"): sent
// right away when online, or queued on the device and replayed here in
// order. All idempotent by the device's uuid.
export async function POST(request: Request) {
  const user = await userWithPermission("sell");
  if (!user) return unauthorized();

  const body = (await readJson(request)) as { op?: string; data?: unknown } | null;
  const actor = { id: user.id, role: user.role };

  try {
    switch (body?.op) {
      case "open":
        await openShiftUseCase(cashShiftRepository, body.data, actor);
        break;
      case "movement":
        await recordCashMovementUseCase(cashShiftRepository, body.data, actor);
        break;
      case "close":
        await closeShiftUseCase(cashShiftRepository, body.data, actor);
        break;
      default:
        return NextResponse.json(
          { code: "invalid", error: "Operación desconocida" },
          { status: 400 },
        );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return workerErrorResponse(error);
  }
}
