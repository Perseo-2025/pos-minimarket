import { z } from "zod";
import { CAPTURE_SOURCES } from "@/domain/value-objects/capture-source";
import { idSchema } from "./id";

const blankToNull = (value: unknown) =>
  value === "" || value === undefined ? null : value;

export const dailyCountSchema = z.object({
  locationId: idSchema,
  items: z
    .array(
      z.object({
        productId: idSchema,
        counted: z.coerce
          .number("Escribe cuántos contaste")
          .int("La cantidad debe ser un número entero")
          .min(0, "La cantidad no puede ser negativa"),
        lots: z
          .array(
            z.object({
              expiresAt: z.iso.date("Escribe la fecha de vencimiento"),
              quantity: z.coerce.number().int().positive(),
            }),
          )
          .max(20)
          .default([]),
        captureSource: z.enum(CAPTURE_SOURCES).nullable().default(null),
      }),
    )
    .min(1, "Cuenta al menos un producto")
    .max(30, "Máximo 30 productos por conteo"),
});

export const reviewCountSchema = z
  .object({
    id: idSchema,
    approve: z.boolean(),
    note: z.preprocess(blankToNull, z.string().trim().max(200).nullable()),
  })
  .refine((data) => data.approve || data.note, {
    message: "Escribe por qué se debe recontar",
    path: ["note"],
  });
