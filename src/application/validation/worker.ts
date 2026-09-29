import { z } from "zod";
import { DNI_PATTERN, PIN_PATTERN } from "@/domain/entities/worker";

export const dniSchema = z
  .string()
  .trim()
  .regex(DNI_PATTERN, "El DNI debe tener 8 dígitos");

export const pinSchema = z
  .string()
  .regex(PIN_PATTERN, "La clave debe tener 6 números");

// PINs never travel or rest in plain text inside the offline queue: the POS
// hashes them before queuing. The hash format is checked by the use case.
const pinHashSchema = z.string().min(20).max(300);

export const workerRegisterSchema = z.object({
  id: z.uuid(),
  dni: dniSchema,
  fullName: z
    .string()
    .trim()
    .min(3, "Escribe el nombre completo")
    .max(120)
    .transform((value) => value.replace(/\s+/g, " ").toUpperCase()),
  nameSource: z.enum(["api", "manual"]),
  company: z
    .string()
    .trim()
    .min(2, "Escribe la empresa donde trabaja")
    .max(80),
  pinHash: pinHashSchema,
  occurredAt: z.iso.datetime(),
});

export const pinResetSchema = z.object({
  id: z.uuid(),
  workerId: z.uuid(),
  pinHash: pinHashSchema,
  occurredAt: z.iso.datetime(),
});

export const pinFailureSchema = z.object({
  id: z.uuid(),
  workerId: z.uuid(),
  occurredAt: z.iso.datetime(),
});

export const verifyPinSchema = z.object({
  dni: dniSchema,
  pin: pinSchema,
});

export const discountPolicySchema = z.object({
  // Legacy: the % now lives on each product. Kept (as 0) so policy versions
  // stay comparable with the ones saved before per-product discounts.
  discountPercent: z.number().min(0).max(50).default(0),
  maxDiscountedSalesPerDay: z
    .number()
    .int("Debe ser un número entero")
    .min(0)
    .max(50),
  maxDiscountPerMonth: z.number().min(0).max(100_000),
  pointsPerSol: z.number().min(0).max(100),
});

export type WorkerRegisterInput = z.infer<typeof workerRegisterSchema>;
export type PinResetInput = z.infer<typeof pinResetSchema>;
