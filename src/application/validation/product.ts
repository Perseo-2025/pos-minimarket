import { z } from "zod";
import { PRODUCT_CATEGORIES } from "@/domain/entities/product";

export const productCreateSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  description: z.string().optional(),
  category: z.enum(PRODUCT_CATEGORIES),
  priceSale: z.coerce.number().positive("El precio debe ser mayor a 0"),
});

export const productUpdateSchema = productCreateSchema.extend({
  id: z.uuid(),
});

export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
