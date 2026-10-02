import { z } from "zod";
import { idSchema, idWithMessage } from "./id";

export const stockCountSchema = z.object({
  productId: idSchema,
  locationId: idWithMessage("Selecciona la ubicación"),
  counted: z.coerce
    .number()
    .int("La cantidad debe ser un número entero")
    .min(0, "La cantidad no puede ser negativa"),
  note: z.string().max(200, "Máximo 200 caracteres").optional(),
  // Units by expiry date, for products that control expiry.
  lots: z
    .array(
      z.object({
        expiresAt: z.iso.date("Escribe la fecha de vencimiento"),
        quantity: z.coerce
          .number()
          .int("La cantidad debe ser un número entero")
          .positive("Cada lote debe tener al menos 1 unidad"),
      }),
    )
    .max(20, "Máximo 20 fechas por conteo")
    .default([]),
});

export type StockCountInput = z.infer<typeof stockCountSchema>;
