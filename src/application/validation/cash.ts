import { z } from "zod";
import { idSchema } from "./id";

const blankToNull = (value: unknown) =>
  value === "" || value === undefined ? null : value;

const money = (message: string) =>
  z.coerce.number(message).nonnegative("El monto no puede ser negativo").max(1_000_000);

// "Abrir caja": generated on the device so it works without internet.
export const openShiftSchema = z.object({
  uuid: z.uuid(),
  openingCash: money("Escribe con cuánto dinero empiezas"),
  openedAt: z.iso.datetime(),
});

export const cashMovementSchema = z.object({
  uuid: z.uuid(),
  shiftUuid: z.uuid(),
  type: z.enum(["in", "out"]),
  amount: money("Escribe el monto").positive("El monto debe ser mayor a 0"),
  reason: z
    .string()
    .trim()
    .min(3, "Escribe el motivo (ej. Pago a Backus F020-123)")
    .max(120),
  occurredAt: z.iso.datetime(),
});

// "Cerrar caja": what the cashier counted (never what the system expects).
export const closeShiftSchema = z.object({
  uuid: z.uuid(),
  closedAt: z.iso.datetime(),
  countedCash: money("Escribe cuánto efectivo contaste"),
  countedYape: money("Escribe cuánto llegó por Yape/Plin"),
  countedCard: money("Escribe cuánto se cobró con tarjeta"),
  note: z.preprocess(blankToNull, z.string().trim().max(200).nullable()),
  reportedSales: z.coerce.number().int().nonnegative(),
});

export const reviewShiftSchema = z.object({
  id: idSchema,
  note: z.preprocess(blankToNull, z.string().trim().max(200).nullable()),
});
