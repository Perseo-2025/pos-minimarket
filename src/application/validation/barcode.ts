import { z } from "zod";

// EAN-8, EAN-13, UPC-A or ITF-14: what is printed on units, displays and
// boxes. Blank = the item has no code.
export const barcodeSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || /^\d{8,14}$/.test(value), {
    message: "El código de barras tiene de 8 a 14 dígitos",
  })
  .transform((value) => value || null)
  .nullable()
  .default(null);
