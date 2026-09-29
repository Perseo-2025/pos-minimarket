import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createSaleUseCase } from "@/application/use-cases/sales/create-sale";
import { auth } from "@/infrastructure/auth";
import { saleRepository } from "@/infrastructure/repositories";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || !["admin", "cashier"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const result = await createSaleUseCase(
      saleRepository,
      body,
      session.user.id,
    );
    return NextResponse.json({ synced: true, ...result });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: error.issues },
        { status: 400 },
      );
    }
    console.error("Sale sync failed", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
