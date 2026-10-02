import type { DniLookupResult } from "@/application/use-cases/workers/lookup-dni";

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
