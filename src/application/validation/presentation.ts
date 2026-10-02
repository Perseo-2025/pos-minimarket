import { z } from "zod";
import { barcodeSchema } from "./barcode";
import { idSchema } from "./id";

export const presentationSchema = z.object({
  productId: idSchema,
  name: z
    .string()
    .trim()
    .min(1, "Escribe el nombre (ej. Caja, Display, Pack)")
    .max(40, "Máximo 40 caracteres"),
  // null = contains units directly.
  parentId: idSchema.nullable().default(null),
  qtyOfParent: z.coerce
    .number("Escribe cuántas contiene")
    .int("Debe ser un número entero")
    .min(2, "Debe contener al menos 2")
    .max(10_000, "Máximo 10 000"),
  barcode: barcodeSchema,
});

export const presentationUpdateSchema = presentationSchema.extend({
  id: idSchema,
});
