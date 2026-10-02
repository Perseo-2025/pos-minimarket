"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createPurchaseOrder } from "@/actions/purchasing";
import type {
  ReceiptPresentationOption,
  ReceiptProductOption,
  ReceiptSupplierOption,
} from "@/components/admin/inventory/receipt-form";
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
import { round2 } from "@/domain/value-objects/money";
import { formatSoles } from "@/lib/money";

const UNIT = "unit";

type Line = {
  key: string;
  productId: string;
  presentation: string;
  quantity: string;
  estimatedTotal: string;
};

const newLine = (): Line => ({
  key: crypto.randomUUID(),
  productId: "",
  presentation: UNIT,
  quantity: "",
  estimatedTotal: "",
});

// What to ask the supplier for. The cost is optional: an estimate to know
// how much money the order will need.
export function PurchaseOrderForm({
  products,
  presentations,
  suppliers,
}: {
  products: ReceiptProductOption[];
  presentations: ReceiptPresentationOption[];
  suppliers: ReceiptSupplierOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [supplier, setSupplier] = useState("");
  const [expectedAt, setExpectedAt] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [error, setError] = useState<string | null>(null);

  // The supplier's own categories first.
  const supplierCategories =
    suppliers.find((s) => String(s.id) === supplier)?.categoryIds ?? [];
  const orderedProducts = [...products].sort(
    (a, b) =>
      Number(supplierCategories.includes(b.categoryId)) -
      Number(supplierCategories.includes(a.categoryId)),
  );
  const estimated = round2(
    lines.reduce((sum, line) => sum + (Number(line.estimatedTotal) || 0), 0),
  );

  function update(key: string, patch: Partial<Line>) {
    setLines((prev) =>
      prev.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createPurchaseOrder({
        supplierId: supplier,
        expectedAt,
        note,
        lines: lines.map((line) => ({
          productId: line.productId,
          presentationId: line.presentation === UNIT ? null : line.presentation,
          quantity: line.quantity,
          estimatedTotal: line.estimatedTotal,
        })),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(`Orden de compra #${result.data.id} creada`);
      router.push(`/admin/compras/${result.data.id}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="order-supplier">Proveedor</Label>
            <Select
              value={supplier || null}
              onValueChange={(value) => value && setSupplier(value as string)}
              items={suppliers.map((s) => ({ value: String(s.id), label: s.name }))}
            >
              <SelectTrigger id="order-supplier" className="w-full">
                <SelectValue placeholder="Elige el proveedor" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="order-expected">¿Cuándo llega?</Label>
            <Input
              id="order-expected"
              type="date"
              value={expectedAt}
              onChange={(e) => setExpectedAt(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="font-heading font-semibold">Productos que pides</h2>
        {lines.map((line, index) => {
          const ownPresentations = presentations.filter(
            (p) => String(p.productId) === line.productId,
          );
          const unitsPer =
            line.presentation === UNIT
              ? 1
              : (ownPresentations.find((p) => String(p.id) === line.presentation)
                  ?.unitsTotal ?? 1);
          const units = (Number(line.quantity) || 0) * unitsPer;
          return (
            <Card key={line.key}>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-end gap-2">
                  <div className="flex flex-1 flex-col gap-2">
                    <Label htmlFor={`product-${line.key}`}>Producto {index + 1}</Label>
                    <Select
                      value={line.productId || null}
                      onValueChange={(value) =>
                        value &&
                        update(line.key, { productId: value as string, presentation: UNIT })
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
                    onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                  >
                    <XIcon />
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`presentation-${line.key}`}>En</Label>
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
                    <Input
                      id={`quantity-${line.key}`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      step={1}
                      value={line.quantity}
                      onChange={(e) => update(line.key, { quantity: e.target.value })}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`estimated-${line.key}`}>Costo aprox. (S/)</Label>
                    <Input
                      id={`estimated-${line.key}`}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      placeholder="Opcional"
                      value={line.estimatedTotal}
                      onChange={(e) => update(line.key, { estimatedTotal: e.target.value })}
                    />
                  </div>
                </div>
                {units > 0 && (
                  <p className="text-sm text-muted-foreground tabular-nums">
                    = {units} unidades
                  </p>
                )}
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
        <Label htmlFor="order-note">Nota</Label>
        <Input
          id="order-note"
          placeholder="Opcional. Ej. Pedido tomado por el vendedor Juan"
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
        {estimated > 0 && (
          <span className="text-sm text-muted-foreground">
            Costo aproximado:{" "}
            <strong className="text-lg text-foreground tabular-nums">
              {formatSoles(estimated)}
            </strong>
          </span>
        )}
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Guardando..." : "Crear orden de compra"}
        </Button>
      </div>
    </form>
  );
}
