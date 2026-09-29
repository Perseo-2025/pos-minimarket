import { NextResponse } from "next/server";
import { lookupDniUseCase } from "@/application/use-cases/workers/lookup-dni";
import { DNI_LOOKUP_TIMEOUT_MS, workerDeps } from "@/infrastructure/deps";
import { readJson, requireStaff, unauthorized, workerErrorResponse } from "../http";

// Server-side only: the provider token never reaches the browser.
export async function POST(request: Request) {
  const user = await requireStaff();
  if (!user) return unauthorized();

  try {
    const body = (await readJson(request)) as { dni?: unknown } | null;
    const result = await lookupDniUseCase(
      workerDeps,
      body?.dni,
      DNI_LOOKUP_TIMEOUT_MS,
    );
    return NextResponse.json(result);
  } catch (error) {
    return workerErrorResponse(error);
  }
}
