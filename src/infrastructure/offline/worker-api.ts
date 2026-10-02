import type { DniLookupResult } from "@/application/use-cases/workers/lookup-dni";
import type { WorkerDiscountUsage } from "@/domain/entities/worker";

export type OnlineVerifyResult =
  | {
      kind: "ok";
      worker: {
        id: number;
        dni: string;
        fullName: string;
        company: string;
        pointsBalance: number;
      };
      usage: WorkerDiscountUsage;
      token: string;
    }
  | { kind: "invalid_pin"; attemptsLeft: number }
  | { kind: "locked"; message: string }
  | { kind: "not_active"; message: string }
  | { kind: "not_found" }
  // Network down, server error or expired session: verify offline instead.
  | { kind: "unreachable" };

export async function verifyPinOnline(dni: string, pin: string): Promise<OnlineVerifyResult> {
  try {
    const response = await fetch("/api/workers/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dni, pin }),
    });
    const body = await response.json().catch(() => null);

    if (response.ok) return { kind: "ok", ...body };
    switch (body?.code) {
      case "invalid_pin":
        return { kind: "invalid_pin", attemptsLeft: body.attemptsLeft ?? 0 };
      case "locked":
        return { kind: "locked", message: body.error };
      case "not_active":
        return { kind: "not_active", message: body.error };
      case "not_found":
        return { kind: "not_found" };
      default:
        return { kind: "unreachable" };
    }
  } catch {
    return { kind: "unreachable" };
  }
}

export async function lookupDniOnline(dni: string): Promise<DniLookupResult> {
  if (!navigator.onLine) return { status: "unavailable" };
  try {
    const response = await fetch("/api/workers/lookup-dni", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dni }),
    });
    if (!response.ok) return { status: "unavailable" };
    return (await response.json()) as DniLookupResult;
  } catch {
    return { status: "unavailable" };
  }
}
