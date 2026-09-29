import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { approveCourtesyUseCase } from "@/application/use-cases/sales/approve-courtesy";
import { InvalidAdminCredentialsError } from "@/domain/errors";
import { courtesyDeps } from "@/infrastructure/deps";
import { readJson, requireStaff, unauthorized } from "../../workers/http";

// The cashier's till asks an admin to approve giving products away. The
// admin types their own credentials; the till gets back a signed approval
// bound to this sale and amount (see courtesy-token.ts).
export async function POST(request: Request) {
  const user = await requireStaff();
  if (!user) return unauthorized();

  try {
    const result = await approveCourtesyUseCase(
      courtesyDeps,
      await readJson(request),
      user.id,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof InvalidAdminCredentialsError) {
      return NextResponse.json(
        { code: "invalid_credentials", error: error.message },
        { status: 403 },
      );
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        { code: "invalid", error: error.issues[0]?.message ?? "Datos inválidos" },
        { status: 400 },
      );
    }
    console.error("Courtesy approval failed", error);
    return NextResponse.json(
      { code: "server", error: "Error del servidor" },
      { status: 500 },
    );
  }
}
