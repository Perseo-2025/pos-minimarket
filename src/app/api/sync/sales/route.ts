import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createSaleUseCase } from "@/application/use-cases/sales/create-sale";
import {
  CashierNotFoundError,
  ForbiddenError,
  UnauthorizedError,
} from "@/domain/errors";
import { auth } from "@/infrastructure/auth";
import { saleDeps } from "@/infrastructure/deps";

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
      saleDeps,
      body,
      session.user.id,
    );
    return NextResponse.json({ synced: true, ...result });
  } catch (error) {
    // 401/403 are not the sale's fault: the client keeps it queued and
    // retries once the right cashier (or an admin) is logged in.
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: error.issues },
        { status: 400 },
      );
    }
    if (error instanceof CashierNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Sale sync failed", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
