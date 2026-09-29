import { NextResponse } from "next/server";
import { getWorkerSnapshotUseCase } from "@/application/use-cases/workers/worker-snapshot";
import { workerDeps } from "@/infrastructure/deps";
import { requireStaff, unauthorized } from "../../workers/http";

// Offline snapshot for the POS (see offline/worker-cache.ts).
export async function GET() {
  const user = await requireStaff();
  if (!user) return unauthorized();

  const snapshot = await getWorkerSnapshotUseCase(workerDeps);
  return NextResponse.json(snapshot, {
    headers: { "Cache-Control": "no-store" },
  });
}
