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

const productFields = z.object({
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
  // Soles an airport worker gets off each unit. Always below the price: a
  // worker never takes a product for free (only the birthday gift).
  workerDiscountAmount: z.coerce
    .number("El descuento debe ser un número")
    .min(0, "El descuento no puede ser negativo")
    .default(0),
  // null removes the image; omitted leaves it unchanged on update.
  imageUrl: productImageUrl.nullable().optional(),
});

function discountBelowPrice(data: { priceSale: number; workerDiscountAmount: number }) {
  return data.workerDiscountAmount < data.priceSale;
}
const discountBelowPriceIssue = {
  message: "El descuento debe ser menor que el precio",
  path: ["workerDiscountAmount"],
};

export const productCreateSchema = productFields.refine(
  discountBelowPrice,
  discountBelowPriceIssue,
);

export const productUpdateSchema = productFields
  .extend({ id: idSchema })
  .refine(discountBelowPrice, discountBelowPriceIssue);

export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
