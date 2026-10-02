import { z } from "zod";
import { CATEGORY_ICONS } from "@/domain/entities/category";
import { idSchema } from "./id";

export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(40, "Máximo 40 caracteres"),
  icon: z.enum(CATEGORY_ICONS, "Ícono no válido").nullable().default(null),
  sortOrder: z.coerce
    .number()
    .int("El orden debe ser un número entero")
    .min(0, "El orden no puede ser negativo")
    .max(999)
    .default(0),
  tracksExpiry: z.boolean().default(false),
  expiryWarningDays: z.coerce
    .number()
    .int("Los días deben ser un número entero")
    .min(1, "Avisa con al menos 1 día")
    .max(365, "Máximo 365 días")
    .default(30),
});

export const categoryUpdateSchema = categorySchema.extend({ id: idSchema });

export type CategoryInput = z.infer<typeof categorySchema>;
