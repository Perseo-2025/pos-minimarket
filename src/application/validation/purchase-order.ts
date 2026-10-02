import { z } from "zod";
import { idSchema, idWithMessage } from "./id";

const blankToNull = (value: unknown) =>
  value === "" || value === undefined ? null : value;

export const purchaseOrderSchema = z.object({
  supplierId: idWithMessage("Elige el proveedor"),
  expectedAt: z.preprocess(
    blankToNull,
    z.iso.date("Fecha de entrega inválida").nullable(),
  ),
  note: z.preprocess(blankToNull, z.string().trim().max(200).nullable()),
  lines: z
    .array(
      z.object({
        productId: idSchema,
        presentationId: z.preprocess(blankToNull, idSchema.nullable()),
        quantity: z.coerce
          .number("Escribe la cantidad")
          .int("La cantidad debe ser un número entero")
          .positive("La cantidad debe ser mayor a 0"),
        // Expected cost of the line, if the supplier quoted it.
        estimatedTotal: z.preprocess(
          blankToNull,
          z.coerce.number().nonnegative("El costo no puede ser negativo").nullable(),
        ),
      }),
    )
    .min(1, "Agrega al menos un producto")
    .max(100, "Máximo 100 líneas por orden"),
});
