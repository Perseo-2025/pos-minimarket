"use client";

import { ArrowRightIcon, PlusIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { transferStock } from "@/actions/inventory";
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
import { QuantityStepper } from "@/components/scanner/quantity-stepper";
import { ScanHint, useScanFlash } from "@/components/scanner/scanner-status";
import { buildBarcodeIndex } from "@/domain/services/barcode-scan";
import type { CaptureSource } from "@/domain/value-objects/capture-source";
import { useScanner } from "@/hooks/use-scanner";
import { cn } from "@/lib/utils";

export type TransferProductOption = {
  id: number;
  name: string;
  // Units in the Almacén right now.
  available: number;
  barcode: string | null;
  presentations: { id: number; name: string; unitsTotal: number; barcode: string | null }[];
};

const UNIT = "unit";

type Line = {
  key: string;
  productId: string;
  presentation: string;
  quantity: string;
  captureSource: CaptureSource;
};

const newLine = (): Line => ({
  key: crypto.randomUUID(),
  productId: "",
  presentation: UNIT,
  quantity: "",
  captureSource: "manual",
});

// Almacén → Tienda: from then on the products show up at the till.
export function TransferForm({
  products,
  doneHref,
}: {
  products: TransferProductOption[];
  // Where to go once saved (admin history or the warehouse home).
  doneHref: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  function update(key: string, patch: Partial<Line>) {
    setLines((prev) =>
      prev.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  const barcodes = useMemo(
    () =>
      buildBarcodeIndex({
        units: products.map((p) => ({ productId: p.id, barcode: p.barcode })),
        presentations: products.flatMap((p) =>
          p.presentations.map((pr) => ({ ...pr, productId: p.id })),
        ),
      }),
    [products],
  );
  const feedback = useScanFlash();
  const [scannedKey, setScannedKey] = useState<string | null>(null);

  // Each trigger on what goes to the shop floor adds 1 (box or unit).
  const { lastScanAt } = useScanner((code, source) => {
    const target = barcodes.get(code);
    if (!target) {
      feedback.fail();
      toast.error("Código no registrado", {
        id: "scan-unknown",
        description: `${code}. Elige el producto de la lista.`,
      });
      return;
    }
    const product = products.find((p) => p.id === target.productId);
    if (!product) {
      // Codes only cover what the Almacén holds: anything else isn't here.
      feedback.fail();
      toast.error("Ese producto no tiene stock en el Almacén", { id: "scan-unknown" });
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
      const result = await transferStock({
        note,
        lines: lines.map((line) => ({
          productId: line.productId,
          presentationId: line.presentation === UNIT ? null : line.presentation,
          quantity: line.quantity,
          captureSource: line.captureSource,
        })),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(`Traslado #${result.data.id} listo: ya se puede vender en caja`);
      router.push(doneHref);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex items-center gap-3 text-sm font-medium">
        <span className="rounded-lg border px-3 py-1.5">Almacén</span>
        <ArrowRightIcon className="size-4 text-muted-foreground" />
        <span className="rounded-lg border border-primary bg-primary/5 px-3 py-1.5">
          Tienda
        </span>
      </div>

      <div className="flex flex-col gap-3">
        <ScanHint lastScanAt={lastScanAt} flash={feedback.flash}>
          Dispara el lector sobre lo que llevas a la Tienda.
        </ScanHint>
        {lines.map((line, index) => {
          const product = products.find((p) => String(p.id) === line.productId);
          const unitsPer =
            line.presentation === UNIT
              ? 1
              : (product?.presentations.find((p) => String(p.id) === line.presentation)
                  ?.unitsTotal ?? 1);
          const units = (Number(line.quantity) || 0) * unitsPer;
          const tooMany = product !== undefined && units > product.available;
          return (
            <Card
              key={line.key}
              id={`line-${line.key}`}
              className={cn(line.key === scannedKey && "ring-2 ring-primary")}
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
                      items={products.map((p) => ({
                        value: String(p.id),
                        label: `${p.name} (${p.available} en Almacén)`,
                      }))}
                    >
                      <SelectTrigger id={`product-${line.key}`} className="w-full">
                        <SelectValue placeholder="Elige el producto" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.name} ({p.available} en Almacén)
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
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`quantity-${line.key}`}>Cantidad</Label>
                    <QuantityStepper
                      id={`quantity-${line.key}`}
                      min={1}
                      value={line.quantity}
                      onChange={(quantity) => update(line.key, { quantity })}
                      invalid={tooMany}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`presentation-${line.key}`}>En</Label>
                    <Select
                      value={line.presentation}
                      onValueChange={(value) =>
                        value && update(line.key, { presentation: value as string })
                      }
                      items={[
                        { value: UNIT, label: "Unidades" },
                        ...(product?.presentations ?? []).map((p) => ({
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
                        {(product?.presentations ?? []).map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.name} ({p.unitsTotal} und)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {product && units > 0 && (
                  <p
                    className={cn(
                      "text-sm tabular-nums",
                      tooMany ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {tooMany
                      ? `Solo hay ${product.available} unidades en el Almacén`
                      : `= ${units} unidades · quedarán ${product.available - units} en el Almacén`}
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
        <Label htmlFor="transfer-note">Nota</Label>
        <Input
          id="transfer-note"
          placeholder="Opcional. Ej. Reposición del turno tarde"
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

      <div className="flex justify-end border-t pt-4">
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Trasladando..." : "Trasladar a Tienda"}
        </Button>
      </div>
    </form>
  );
}
