import { ValidationError } from "@/domain/errors";
import type { ReceivingRepository } from "@/domain/repositories/receiving-repository";
import { allowedResolutions } from "@/domain/services/receiving";
import { resolveDiscrepancySchema } from "@/application/validation/receiving";

export function listDiscrepanciesUseCase(repo: ReceivingRepository) {
  return repo.listDiscrepancies(200);
}

// The admin says what happened with units that didn't match the invoice.
export async function resolveDiscrepancyUseCase(
  repo: ReceivingRepository,
  input: unknown,
  actorId: number,
) {
  const data = resolveDiscrepancySchema.parse(input);
  const gap = await repo.findDiscrepancy(data.id);
  if (!gap) throw new ValidationError("La diferencia no existe");
  if (gap.status !== "open") throw new ValidationError("Esta diferencia ya fue resuelta");
  if (!allowedResolutions(gap.units).includes(data.status)) {
    throw new ValidationError(
      gap.units < 0
        ? "Para lo que faltó elige: lo trajo, lo descontó o se asume la pérdida"
        : "Para lo que sobró elige: nos quedamos o se devolvió",
    );
  }
  if (data.status === "replenished" && gap.tracksExpiry && !data.expiresAt) {
    throw new ValidationError(
      `${gap.productName} vence: escribe la fecha de lo que trajo el proveedor`,
    );
  }

  await repo.resolveDiscrepancy({
    id: data.id,
    status: data.status,
    note: data.note,
    expiresAt: data.status === "replenished" ? data.expiresAt : null,
    actorId,
  });
}
