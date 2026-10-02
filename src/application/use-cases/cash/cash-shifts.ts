import { can, type UserRole } from "@/domain/entities/user";
import { ValidationError } from "@/domain/errors";
import type { CashShiftRepository } from "@/domain/repositories/cash-shift-repository";
import { salesStillSyncing } from "@/domain/services/cash-shift";
import {
  cashMovementSchema,
  closeShiftSchema,
  openShiftSchema,
  reviewShiftSchema,
} from "@/application/validation/cash";

type Actor = { id: number; role: UserRole };

// Only the shift's own cashier (or an admin) may move or close it.
async function ownShift(repo: CashShiftRepository, uuid: string, actor: Actor) {
  const shift = await repo.findOwner(uuid);
  if (!shift) throw new ValidationError("La caja no existe");
  if (shift.cashierId !== actor.id && !can(actor.role, "manage")) {
    throw new ValidationError("Esta caja es de otro cajero");
  }
  return shift;
}

export async function openShiftUseCase(
  repo: CashShiftRepository,
  input: unknown,
  actor: Actor,
) {
  const data = openShiftSchema.parse(input);
  // Retried sync of the same opening: already done.
  if (await repo.findOwner(data.uuid)) return;
  await repo.open({
    uuid: data.uuid,
    cashierId: actor.id,
    openedAt: new Date(data.openedAt),
    openingCash: data.openingCash,
  });
}

export async function recordCashMovementUseCase(
  repo: CashShiftRepository,
  input: unknown,
  actor: Actor,
) {
  const data = cashMovementSchema.parse(input);
  await ownShift(repo, data.shiftUuid, actor);
  await repo.addMovement({
    ...data,
    occurredAt: new Date(data.occurredAt),
    actorId: actor.id,
  });
}

export async function closeShiftUseCase(
  repo: CashShiftRepository,
  input: unknown,
  actor: Actor,
) {
  const data = closeShiftSchema.parse(input);
  const shift = await ownShift(repo, data.uuid, actor);
  // Retried sync of the same closing: already done.
  if (shift.status !== "open") return;
  await repo.close({
    uuid: data.uuid,
    closedAt: new Date(data.closedAt),
    counted: { cash: data.countedCash, yape: data.countedYape, card: data.countedCard },
    note: data.note,
    reportedSales: data.reportedSales,
  });
}

export function listShiftsUseCase(repo: CashShiftRepository, from: Date, to: Date) {
  return repo.list(from, to);
}

// The admin looked at the difference: the expected amounts are frozen so the
// record doesn't change if something else syncs later.
export async function reviewShiftUseCase(
  repo: CashShiftRepository,
  input: unknown,
  actorId: number,
) {
  const data = reviewShiftSchema.parse(input);
  const shift = await repo.findById(data.id);
  if (!shift) throw new ValidationError("La caja no existe");
  if (shift.status === "open") throw new ValidationError("Esta caja todavía está abierta");
  if (shift.status === "reviewed") throw new ValidationError("Esta caja ya fue revisada");
  const missing = salesStillSyncing(shift.reportedSales, shift.syncedSales);
  if (missing > 0) {
    throw new ValidationError(
      `Faltan llegar ${missing} ventas de este turno (se hicieron sin internet). Espera a que la tablet se conecte.`,
    );
  }
  await repo.review({
    id: shift.id,
    expected: shift.expected,
    note: data.note,
    actorId,
  });
}
