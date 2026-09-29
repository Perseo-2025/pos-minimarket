import { z } from "zod";

export const saleItemSchema = z.object({
  id: z.uuid(),
  productId: z.uuid(),
  productName: z.string().min(1),
  unitPrice: z.number().positive(),
  quantity: z.number().int().positive(),
  lineTotal: z.number().nonnegative(),
});

export const saleCreateSchema = z.object({
  id: z.uuid(),
  paymentType: z.enum(["cash", "yape_plin", "card"]),
  items: z.array(saleItemSchema).min(1),
  total: z.number().nonnegative(),
  clientCreatedAt: z.iso.datetime(),
});

export type SaleItemInput = z.infer<typeof saleItemSchema>;
export type SaleCreateInput = z.infer<typeof saleCreateSchema>;
