import { NextResponse } from "next/server";
import { verifyWorkerPinUseCase } from "@/application/use-cases/workers/verify-worker-pin";
import { workerDeps } from "@/infrastructure/deps";
import { readJson, requireStaff, unauthorized, workerErrorResponse } from "../http";

export async function POST(request: Request) {
  const user = await requireStaff();
  if (!user) return unauthorized();

  try {
    const result = await verifyWorkerPinUseCase(
      workerDeps,
      await readJson(request),
      user.id,
    );
    return NextResponse.json(result);
  } catch (error) {
    return workerErrorResponse(error);
  }
}
