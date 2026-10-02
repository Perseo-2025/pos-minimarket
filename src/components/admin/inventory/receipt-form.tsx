"use client";

import { GiftIcon, PlusIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { receiveGoods } from "@/actions/inventory";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RECEIPT_DOC_TYPE_LABELS,
  RECEIPT_DOC_TYPES,
  type ReceiptDocType,
} from "@/domain/entities/receiving";
import { round2 } from "@/domain/value-objects/money";
import { formatSoles } from "@/lib/money";
import { cn } from "@/lib/utils";
import { QuantityStepper } from "@/components/scanner/quantity-stepper";
import { ScanHint, useScanFlash } from "@/components/scanner/scanner-status";
import { buildBarcodeIndex } from "@/domain/services/barcode-scan";
import type { CaptureSource } from "@/domain/value-objects/capture-source";
import { useScanner } from "@/hooks/use-scanner";

export type ReceiptProductOption = {
  id: number;
  name: string;
  categoryId: number;
  tracksExpiry: boolean;
  barcode: string | null;
};
export type ReceiptPresentationOption = {
  id: number;
  productId: number;
  name: string;
  unitsTotal: number;
  barcode: string | null;
};
export type ReceiptSupplierOption = {
  id: number;
  name: string;
  categoryIds: number[];
};
// An open purchase order, with what is still missing from it.
export type ReceiptOrderOption = {
  id: number;
  supplierId: number;
  label: string;
  lines: {
    productId: number;
    presentationId: number | null;
    quantity: number;
    estimatedTotal: number | null;
  }[];
};

// Select values are strings; these stand for "no supplier" / "by the unit".
const NONE = "none";
const UNIT = "unit";

type Line = {
  key: string;
  productId: string;
  presentation: string;
  quantity: string;
  lineTotal: string;
  isBonus: boolean;
  expiresAt: string;
  // Unticked when something is missing (or extra): then `received` says
  // how many units actually arrived.
  complete: boolean;
  received: string;
  // Fired with the reader, or picked from the list.
  captureSource: CaptureSource;
};

const newLine = (): Line => ({
  key: crypto.randomUUID(),
  productId: "",
  presentation: UNIT,
  quantity: "",
  lineTotal: "",
  isBonus: false,
  expiresAt: "",
  complete: true,
  received: "",
  captureSource: "manual",
});

function linesFromOrder(order: ReceiptOrderOption): Line[] {
  return order.lines.map((line) => ({
    ...newLine(),
    productId: String(line.productId),
    presentation: line.presentationId === null ? UNIT : String(line.presentationId),
    quantity: String(line.quantity),
    lineTotal: line.estimatedTotal === null ? "" : String(line.estimatedTotal),
  }));
}

// Merchandise arriving at the Almacén: supplier and document, then one line
// per product (and per expiry date / bonus).
export function ReceiptForm({
  products,
  presentations,
  suppliers,
  orders,
  initialOrderId,
  doneHref,
}: {
  products: ReceiptProductOption[];
  presentations: ReceiptPresentationOption[];
  suppliers: ReceiptSupplierOption[];
  orders: ReceiptOrderOption[];
  // Coming from an order's page ("Registrar lo que llegó").
  initialOrderId?: number;
  // Where to go once saved (admin history or the warehouse home).
  doneHref: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const initialOrder = orders.find((o) => o.id === initialOrderId);
  const [orderId, setOrderId] = useState(
    initialOrder ? String(initialOrder.id) : NONE,
  );
  const [supplier, setSupplier] = useState(
    initialOrder ? String(initialOrder.supplierId) : NONE,
  );
  const [docType, setDocType] = useState<ReceiptDocType>("factura");
  const [docNumber, setDocNumber] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>(() =>
    initialOrder ? linesFromOrder(initialOrder) : [newLine()],
  );

  // Picking an order fills its supplier and what is still missing from it;
  // the lines can then be corrected to what actually arrived.
  function chooseOrder(value: string) {
    setOrderId(value);
    const order = orders.find((o) => String(o.id) === value);
    if (!order) return;
    setSupplier(String(order.supplierId));
    setLines(linesFromOrder(order));
  }
  const [error, setError] = useState<string | null>(null);

  // The chosen supplier's products first (by the categories it delivers).
  const supplierCategories =
    suppliers.find((s) => String(s.id) === supplier)?.categoryIds ?? [];
  const orderedProducts = [...products].sort(
    (a, b) =>
      Number(supplierCategories.includes(b.categoryId)) -
      Number(supplierCategories.includes(a.categoryId)),
  );

  const productOf = (line: Line) =>
    products.find((p) => String(p.id) === line.productId);
  const unitsPer = (line: Line) =>
    line.presentation === UNIT
      ? 1
      : (presentations.find((p) => String(p.id) === line.presentation)
          ?.unitsTotal ?? 1);

  const total = round2(
    lines.reduce(
      (sum, line) => sum + (line.isBonus ? 0 : Number(line.lineTotal) || 0),
      0,
    ),
  );

  function update(key: string, patch: Partial<Line>) {
    setLines((prev) =>
      prev.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  const barcodes = useMemo(
    () =>
      buildBarcodeIndex({
        units: products.map((p) => ({ productId: p.id, barcode: p.barcode })),
        presentations,
      }),
    [products, presentations],
  );
  const feedback = useScanFlash();
  // The line the last scan went to, highlighted so the count can be checked.
  const [scannedKey, setScannedKey] = useState<string | null>(null);

  // Each trigger on a box adds 1 Caja; on a loose unit, 1 unit.
  const { lastScanAt } = useScanner((code, source) => {
    const target = barcodes.get(code);
    const product = target && products.find((p) => p.id === target.productId);
    if (!target || !product) {
      feedback.fail();
      toast.error("Código no registrado", {
        id: "scan-unknown",
        description: `${code}. Elige el producto de la lista y pide al administrador que registre el código.`,
      });
      return;
    }
    const presentation =
      target.kind === "presentation" ? String(target.presentationId) : UNIT;
    const existing = lines.find(
      (l) => l.productId === String(product.id) && l.presentation === presentation,
    );
    const blank = lines.find((l) => l.productId === "");
    let key: string;
    if (existing) {
      key = existing.key;
      update(key, {
        quantity: String((Number(existing.quantity) || 0) + 1),
        captureSource: existing.captureSource === "scan" ? source : "manual",
      });
    } else {
      const line = {
        ...(blank ?? newLine()),
        productId: String(product.id),
        presentation,
        quantity: "1",
        captureSource: source,
      };
      key = line.key;
      setLines((prev) =>
        blank ? prev.map((l) => (l.key === blank.key ? line : l)) : [...prev, line],
      );
    }
    setScannedKey(key);
    feedback.ok();
    requestAnimationFrame(() =>
      document.getElementById(`line-${key}`)?.scrollIntoView({ block: "center", behavior: "smooth" }),
    );
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await receiveGoods({
        orderId: orderId === NONE ? null : Number(orderId),
        supplierId: supplier === NONE ? null : Number(supplier),
        docType,
        docNumber: docType === "ninguno" ? null : docNumber,
        note,
        lines: lines.map((line) => ({
          productId: line.productId,
          presentationId: line.presentation === UNIT ? null : line.presentation,
          quantity: line.quantity,
          lineTotal: line.isBonus ? null : line.lineTotal,
          isBonus: line.isBonus,
          receivedUnits: line.complete ? null : line.received,
          expiresAt: productOf(line)?.tracksExpiry ? line.expiresAt : null,
          captureSource: line.captureSource,
        })),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(`Ingreso #${result.data.id} registrado en el Almacén`);
      router.push(doneHref);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          {orders.length > 0 && (
            <div className="flex flex-col gap-2 sm:col-span-3">
              <Label htmlFor="receipt-order">¿Viene de una orden de compra?</Label>
              <Select
                value={orderId}
                onValueChange={(value) => value && chooseOrder(value as string)}
                items={[
                  { value: NONE, label: "No, ingreso sin orden" },
                  ...orders.map((o) => ({ value: String(o.id), label: o.label })),
                ]}
              >
                <SelectTrigger id="receipt-order" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No, ingreso sin orden</SelectItem>
                  {orders.map((o) => (
                    <SelectItem key={o.id} value={String(o.id)}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="receipt-supplier">Proveedor</Label>
            <Select
              disabled={orderId !== NONE}
              value={supplier}
              onValueChange={(value) => value && setSupplier(value as string)}
              items={[
                { value: NONE, label: "Sin proveedor" },
                ...suppliers.map((s) => ({ value: String(s.id), label: s.name })),
              ]}
            >
              <SelectTrigger id="receipt-supplier" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sin proveedor</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="receipt-doc-type">Documento</Label>
            <Select
              value={docType}
              onValueChange={(value) => value && setDocType(value as ReceiptDocType)}
              items={RECEIPT_DOC_TYPES.map((type) => ({
                value: type,
                label: RECEIPT_DOC_TYPE_LABELS[type],
              }))}
            >
              <SelectTrigger id="receipt-doc-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECEIPT_DOC_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {RECEIPT_DOC_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="receipt-doc-number">Serie y número</Label>
            <Input
              id="receipt-doc-number"
              placeholder="F020-00014194"
              value={docNumber}
              onChange={(e) => setDocNumber(e.target.value)}
              disabled={docType === "ninguno"}
              required={docType !== "ninguno"}
              className="font-mono uppercase"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="font-heading font-semibold">Productos que llegaron</h2>
        <ScanHint lastScanAt={lastScanAt} flash={feedback.flash}>
          Dispara el lector sobre cada caja: suma 1 por disparo.
        </ScanHint>
        {products.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Primero registra productos en Productos.
          </p>
        )}
        {lines.map((line, index) => {
          const product = productOf(line);
          const units = (Number(line.quantity) || 0) * unitsPer(line);
          const ownPresentations = presentations.filter(
            (p) => String(p.productId) === line.productId,
          );
          const perUnit =
            !line.isBonus && units > 0 && Number(line.lineTotal) > 0
              ? Number(line.lineTotal) / units
              : null;
          return (
            <Card
              key={line.key}
              id={`line-${line.key}`}
              className={cn(
                line.isBonus && "border-emerald-500/40",
                line.key === scannedKey && "ring-2 ring-primary",
              )}
            >
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-end gap-2">
                  <div className="flex flex-1 flex-col gap-2">
                    <Label htmlFor={`product-${line.key}`}>Producto {index + 1}</Label>
                    <Select
                      value={line.productId || null}
                      onValueChange={(value) =>
                        value &&
                        update(line.key, {
                          productId: value as string,
                          presentation: UNIT,
                          captureSource: "manual",
                        })
                      }
                      items={orderedProducts.map((p) => ({
                        value: String(p.id),
                        label: p.name,
                      }))}
                    >
                      <SelectTrigger id={`product-${line.key}`} className="w-full">
                        <SelectValue placeholder="Elige el producto" />
                      </SelectTrigger>
                      <SelectContent>
                        {orderedProducts.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Quitar producto ${index + 1}`}
                    disabled={lines.length === 1}
                    onClick={() =>
                      setLines((prev) => prev.filter((l) => l.key !== line.key))
                    }
                  >
                    <XIcon />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`presentation-${line.key}`}>Viene en</Label>
                    <Select
                      value={line.presentation}
                      onValueChange={(value) =>
                        value && update(line.key, { presentation: value as string })
                      }
                      items={[
                        { value: UNIT, label: "Unidades" },
                        ...ownPresentations.map((p) => ({
                          value: String(p.id),
                          label: `${p.name} (${p.unitsTotal} und)`,
                        })),
                      ]}
                    >
                      <SelectTrigger id={`presentation-${line.key}`} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNIT}>Unidades</SelectItem>
                        {ownPresentations.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.name} ({p.unitsTotal} und)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`quantity-${line.key}`}>Cantidad</Label>
                    <QuantityStepper
                      id={`quantity-${line.key}`}
                      min={1}
                      value={line.quantity}
                      onChange={(quantity) => update(line.key, { quantity })}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`total-${line.key}`}>Pagaste (S/)</Label>
                    <Input
                      id={`total-${line.key}`}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      placeholder={line.isBonus ? "Regalo" : "0.00"}
                      value={line.isBonus ? "" : line.lineTotal}
                      onChange={(e) => update(line.key, { lineTotal: e.target.value })}
                      disabled={line.isBonus}
                      required={!line.isBonus}
                    />
                  </div>
                  {product?.tracksExpiry && (
                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`expires-${line.key}`}>Vence el</Label>
                      <Input
                        id={`expires-${line.key}`}
                        type="date"
                        value={line.expiresAt}
                        onChange={(e) => update(line.key, { expiresAt: e.target.value })}
                        required
                      />
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={line.complete}
                      onChange={(e) =>
                        update(line.key, {
                          complete: e.target.checked,
                          received: e.target.checked ? "" : String(units || ""),
                        })
                      }
                    />
                    Llegó completo
                  </label>
                  {!line.complete && (
                    <span className="flex items-center gap-2">
                      <Label htmlFor={`received-${line.key}`}>Llegaron</Label>
                      <Input
                        id={`received-${line.key}`}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        value={line.received}
                        onChange={(e) => update(line.key, { received: e.target.value })}
                        className="h-8 w-24"
                        required
                      />
                      <span>unidades</span>
                    </span>
                  )}
                </div>
                {!line.complete && units > 0 && line.received !== "" &&
                  Number(line.received) !== units && (
                    <p
                      className={cn(
                        "rounded-md px-3 py-2 text-sm",
                        Number(line.received) < units
                          ? "bg-amber-500/10 text-amber-800 dark:text-amber-300"
                          : "bg-sky-500/10 text-sky-800 dark:text-sky-300",
                      )}
                    >
                      {Number(line.received) < units
                        ? `Faltan ${units - Number(line.received)} unidades: entran ${line.received} al Almacén y la diferencia queda anotada para reclamar al proveedor.`
                        : `Sobran ${Number(line.received) - units} unidades: entran ${line.received} y la diferencia queda anotada para revisar.`}
                    </p>
                  )}

                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      className="size-4 accent-emerald-600"
                      checked={line.isBonus}
                      onChange={(e) => update(line.key, { isBonus: e.target.checked })}
                    />
                    <GiftIcon className="size-4 text-emerald-600" />
                    Bonificación (regalo del proveedor)
                  </label>
                  {units > 0 && (
                    <span className="text-muted-foreground tabular-nums">
                      Factura: <strong className="text-foreground">{units} unidades</strong>
                      {perUnit !== null && ` · ${formatSoles(perUnit)} c/u`}
                      {line.isBonus && " · costo S/ 0"}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        <Button
          type="button"
          variant="outline"
          className="self-start"
          onClick={() => setLines((prev) => [...prev, newLine()])}
        >
          <PlusIcon data-icon="inline-start" />
          Agregar producto
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="receipt-note">Nota</Label>
        <Input
          id="receipt-note"
          placeholder="Opcional. Ej. Llegó con una caja golpeada"
          maxLength={200}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-4 border-t pt-4">
        <span className="text-sm text-muted-foreground">
          Total pagado:{" "}
          <strong className="text-lg text-foreground tabular-nums">
            {formatSoles(total)}
          </strong>
        </span>
        <Button type="submit" size="lg" disabled={isPending || products.length === 0}>
          {isPending ? "Guardando..." : "Guardar ingreso"}
        </Button>
      </div>
    </form>
  );
}
