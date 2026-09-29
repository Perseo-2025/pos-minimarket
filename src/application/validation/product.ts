import { z } from "zod";

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
  description: z.string().optional(),
  categoryId: z.uuid("Selecciona una categoría"),
  priceSale: z.coerce.number().positive("El precio debe ser mayor a 0"),
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
  id: z.uuid(),
});

export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
