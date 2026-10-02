import { z } from "zod";
import { RECEIPT_DOC_TYPES } from "@/domain/entities/receiving";
import { CAPTURE_SOURCES } from "@/domain/value-objects/capture-source";
import { idSchema } from "./id";

const blankToNull = (value: unknown) =>
  value === "" || value === undefined ? null : value;

const quantity = z.coerce
  .number("Escribe la cantidad")
  .int("La cantidad debe ser un número entero")
  .positive("La cantidad debe ser mayor a 0");

// How the product was identified (reader or by hand). Optional: clients
// from before the reader send none.
const captureSource = z.enum(CAPTURE_SOURCES).nullable().default(null);

export const receiptSchema = z.object({
  supplierId: z.preprocess(blankToNull, idSchema.nullable()),
  orderId: z.preprocess(blankToNull, idSchema.nullable()),
  docType: z.enum(RECEIPT_DOC_TYPES).default("ninguno"),
  docNumber: z.preprocess(
    blankToNull,
    z
      .string()
      .trim()
      .max(30, "Máximo 30 caracteres")
      .transform((value) => value.toUpperCase())
      .nullable(),
  ),
  note: z.preprocess(blankToNull, z.string().trim().max(200).nullable()),
  lines: z
    .array(
      z.object({
        productId: idSchema,
        // null = bought by the unit.
        presentationId: z.preprocess(blankToNull, idSchema.nullable()),
        quantity,
        // What was paid for the line (ignored when it is a bonus).
        lineTotal: z.preprocess(
          blankToNull,
          z.coerce
            .number("Escribe el costo")
            .nonnegative("El costo no puede ser negativo")
            .nullable(),
        ),
        isBonus: z.boolean().default(false),
        // Units that actually arrived; null = everything on the invoice.
        receivedUnits: z.preprocess(
          blankToNull,
          z.coerce
            .number("Escribe cuántas unidades llegaron")
            .int("Debe ser un número entero")
            .min(0, "No puede ser negativo")
            .nullable(),
        ),
        expiresAt: z.preprocess(
          blankToNull,
          z.iso.date("Fecha de vencimiento inválida").nullable(),
        ),
        captureSource,
      }),
    )
    .min(1, "Agrega al menos un producto")
    .max(100, "Máximo 100 líneas por ingreso"),
});

export const transferSchema = z.object({
  note: z.preprocess(blankToNull, z.string().trim().max(200).nullable()),
  lines: z
    .array(
      z.object({
        productId: idSchema,
        presentationId: z.preprocess(blankToNull, idSchema.nullable()),
        quantity,
        captureSource,
      }),
    )
    .min(1, "Agrega al menos un producto")
    .max(100, "Máximo 100 líneas por traslado"),
});

export const resolveDiscrepancySchema = z.object({
  id: idSchema,
  status: z.enum(["replenished", "credited", "written_off", "kept", "returned"]),
  note: z.preprocess(blankToNull, z.string().trim().max(200).nullable()),
  // When the supplier brings the missing units of a product that expires.
  expiresAt: z.preprocess(
    blankToNull,
    z.iso.date("Fecha de vencimiento inválida").nullable(),
  ),
});
