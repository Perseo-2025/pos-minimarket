import { z } from "zod";
import { CAPTURE_SOURCES } from "@/domain/value-objects/capture-source";
import { idSchema } from "./id";

export const saleItemSchema = z.object({
  productId: idSchema,
  productName: z.string().min(1),
  unitPrice: z.number().positive(),
  quantity: z.number().int().positive(),
  lineTotal: z.number().nonnegative(),
  // Per-line worker discount / courtesy. Defaulted so sales queued before
  // per-product discounts existed keep syncing.
  discountPercent: z.number().min(0).max(100).default(0),
  discountAmount: z.number().nonnegative().default(0),
  isCourtesy: z.boolean().default(false),
  // Reader or by hand; absent on sales queued before the reader.
  captureSource: z.enum(CAPTURE_SOURCES).nullable().default(null),
});

export const saleCreateSchema = z.object({
  // Client-generated idempotency key (see SaleInput).
  uuid: z.uuid(),
  // Optional only for sales queued in IndexedDB before cashierId was
  // captured at checkout; those fall back to the syncing user.
  cashierId: idSchema.optional(),
  paymentType: z.enum(["cash", "yape_plin", "card"]),
  items: z.array(saleItemSchema).min(1),
  total: z.number().nonnegative(),
  clientCreatedAt: z.iso.datetime(),
  // Airport-worker discount. All optional/defaulted so sales queued before
  // this feature existed keep syncing.
  workerId: idSchema.optional(),
  workerVerification: z
    .enum(["none", "pin_online", "pin_offline"])
    .default("none"),
  verificationToken: z.string().max(2000).optional(),
  discountTotal: z.number().nonnegative().default(0),
  policyId: idSchema.optional(),
  courtesyToken: z.string().max(2000).optional(),
  // The till shift it was charged in. Optional: sales queued before shifts
  // existed keep syncing.
  shiftUuid: z.uuid().optional(),
});

// Asked by the POS when a cashier marks products as courtesy (free): an admin
// types their own username + password at the till.
export const courtesyApprovalSchema = z.object({
  username: z.string().trim().min(1, "Escribe el usuario del administrador"),
  password: z.string().min(1, "Escribe la contraseña"),
  // The uuid of the sale being built (it has no numeric id yet).
  saleUuid: z.uuid(),
  items: z
    .array(
      z.object({
        productId: idSchema,
        productName: z.string().min(1),
        unitPrice: z.number().positive(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
});

export type SaleItemInput = z.infer<typeof saleItemSchema>;
export type SaleCreateInput = z.infer<typeof saleCreateSchema>;
