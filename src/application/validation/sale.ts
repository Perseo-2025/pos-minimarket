import { z } from "zod";

export const saleItemSchema = z.object({
  id: z.uuid(),
  productId: z.uuid(),
  productName: z.string().min(1),
  unitPrice: z.number().positive(),
  quantity: z.number().int().positive(),
  lineTotal: z.number().nonnegative(),
  // Per-line worker discount / courtesy. Defaulted so sales queued before
  // per-product discounts existed keep syncing.
  discountPercent: z.number().min(0).max(100).default(0),
  discountAmount: z.number().nonnegative().default(0),
  isCourtesy: z.boolean().default(false),
});

export const saleCreateSchema = z.object({
  id: z.uuid(),
  // Optional only for sales queued in IndexedDB before cashierId was
  // captured at checkout; those fall back to the syncing user.
  cashierId: z.uuid().optional(),
  paymentType: z.enum(["cash", "yape_plin", "card"]),
  items: z.array(saleItemSchema).min(1),
  total: z.number().nonnegative(),
  clientCreatedAt: z.iso.datetime(),
  // Airport-worker discount. All optional/defaulted so sales queued before
  // this feature existed keep syncing.
  workerId: z.uuid().optional(),
  workerVerification: z
    .enum(["none", "pin_online", "pin_offline"])
    .default("none"),
  verificationToken: z.string().max(2000).optional(),
  discountTotal: z.number().nonnegative().default(0),
  policyId: z.uuid().optional(),
  courtesyToken: z.string().max(2000).optional(),
});

// Asked by the POS when a cashier marks products as courtesy (free): an admin
// types their own username + password at the till.
export const courtesyApprovalSchema = z.object({
  username: z.string().trim().min(1, "Escribe el usuario del administrador"),
  password: z.string().min(1, "Escribe la contraseña"),
  saleId: z.uuid(),
  items: z
    .array(
      z.object({
        productId: z.uuid(),
        productName: z.string().min(1),
        unitPrice: z.number().positive(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
});

export type SaleItemInput = z.infer<typeof saleItemSchema>;
export type SaleCreateInput = z.infer<typeof saleCreateSchema>;
