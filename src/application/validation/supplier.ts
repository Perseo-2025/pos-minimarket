import { z } from "zod";
import { isValidRuc } from "@/domain/services/ruc";
import { idSchema } from "./id";

// Optional text field: blank means "not provided" (stored as null).
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .transform((value) => value || null)
    .nullable()
    .default(null);

export const supplierSchema = z.object({
  ruc: z
    .string()
    .trim()
    .refine((value) => value === "" || isValidRuc(value), {
      message: "RUC inválido: revisa los 11 dígitos",
    })
    .transform((value) => value || null)
    .nullable()
    .default(null),
  businessName: z
    .string()
    .trim()
    .min(2, "Escribe la razón social")
    .max(150, "Máximo 150 caracteres"),
  tradeName: optionalText(80),
  contactName: optionalText(80),
  phone: z
    .string()
    .trim()
    .refine((value) => value === "" || /^\+?[\d\s-]{6,15}$/.test(value), {
      message: "Teléfono inválido",
    })
    .transform((value) => value || null)
    .nullable()
    .default(null),
  email: z
    .union([z.literal(""), z.email("Correo inválido")])
    .transform((value) => value || null)
    .nullable()
    .default(null),
  address: optionalText(200),
  notes: optionalText(500),
  categoryIds: z.array(idSchema).default([]),
});

export const supplierUpdateSchema = supplierSchema.extend({ id: idSchema });

export type SupplierInput = z.infer<typeof supplierSchema>;
