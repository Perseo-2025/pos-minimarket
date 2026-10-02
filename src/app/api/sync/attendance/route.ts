import { NextResponse } from "next/server";
import {
  attendanceTodayUseCase,
  clockInUseCase,
  clockOutUseCase,
} from "@/application/use-cases/attendance/clock";
import { requestCorrectionUseCase } from "@/application/use-cases/attendance/corrections";
import { currentUser } from "@/infrastructure/auth/guards";
import { attendanceDeps } from "@/infrastructure/deps";
import {
  readJson,
  unauthorized,
  workerErrorResponse,
} from "../../workers/http";

// The logged-in person's attendance today (schedule, open workdays), cached
// on the device so the clock-in screen works without internet.
export async function GET() {
  const user = await currentUser();
  if (!user) return unauthorized();
  try {
    return NextResponse.json(await attendanceTodayUseCase(attendanceDeps, user.id));
  } catch (error) {
    return workerErrorResponse(error);
  }
}

// Attendance marks ("Marcar entrada", "Marcar salida", correction requests):
// sent right away when online, or queued on the device and replayed here in
// order. All idempotent by the device's uuid. The person is always the
// session's user. The server time in the answer lets the device measure how
// wrong its clock is.
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return unauthorized();

  const body = (await readJson(request)) as { op?: string; data?: unknown } | null;
  const actor = { id: user.id, role: user.role };

  try {
    switch (body?.op) {
      case "clock_in":
        await clockInUseCase(attendanceDeps, body.data, actor);
        break;
      case "clock_out":
        await clockOutUseCase(attendanceDeps, body.data, actor);
        break;
      case "correction":
        await requestCorrectionUseCase(attendanceDeps, body.data, actor);
        break;
      default:
        return NextResponse.json(
          { code: "invalid", error: "Operación desconocida" },
          { status: 400 },
        );
    }
    return NextResponse.json({ ok: true, serverTime: new Date().toISOString() });
  } catch (error) {
    return workerErrorResponse(error);
  }
}
