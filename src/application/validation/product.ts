import { z } from "zod";
import { barcodeSchema } from "./barcode";
import { idSchema, idWithMessage } from "./id";

// Only URLs produced by our own upload endpoint are accepted, so a product
// can't be pointed at an arbitrary external host.
const productImageUrl = z
  .string()
  .regex(
    /^\/api\/images\/products\/[0-9a-f-]{36}\.(jpg|png|webp)$/,
    "Imagen inválida",
  );

export const productCreateSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  // The unit's code, scanned at the till.
  barcode: barcodeSchema,
  description: z.string().optional(),
  categoryId: idWithMessage("Selecciona una categoría"),
  priceSale: z.coerce.number().positive("El precio debe ser mayor a 0"),
  // Precio de compra per unit. Optional: blank = not known yet. Selling below
  // it is allowed (the form warns), e.g. to clear old stock.
  priceCost: z.preprocess(
    (value) => (value === "" || value === undefined ? null : value),
    z.coerce
      .number("El precio de compra debe ser un número")
      .nonnegative("El precio de compra no puede ser negativo")
      .nullable(),
  ),
  // null = same as the category (most products).
  tracksExpiry: z.boolean().nullable().default(null),
  // 100% is not a discount but a courtesy: it is approved by an admin at
  // the till, sale by sale, never set on the product.
  workerDiscountPercent: z.coerce
    .number()
    .int("El descuento debe ser un número entero")
    .min(0, "El descuento no puede ser negativo")
    .max(99, "Máximo 99%. Para regalar un producto usa Cortesía en caja")
    .default(0),
  // null removes the image; omitted leaves it unchanged on update.
  imageUrl: productImageUrl.nullable().optional(),
});

export const productUpdateSchema = productCreateSchema.extend({
  id: idSchema,
});

export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
