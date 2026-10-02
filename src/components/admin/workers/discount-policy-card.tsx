"use client";

import { BadgePercentIcon, SettingsIcon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateDiscountPolicy } from "@/actions/workers";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatSoles } from "@/lib/money";

export type PolicyView = {
  maxDiscountedUnitsPerSale: number;
  maxDiscountedSalesPerDay: number;
  pointsPerSol: number;
  birthdayGiftMaxAmount: number;
  createdAt: string;
  createdByName: string | null;
};

const dateFormat = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function DiscountPolicyCard({
  active,
  versions,
}: {
  active: PolicyView | null;
  versions: PolicyView[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-xs md:flex-row md:items-center">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
        <BadgePercentIcon className="size-5" aria-hidden />
      </span>
      <div className="flex-1 space-y-1">
        <p className="text-sm text-muted-foreground">Reglas del descuento vigentes</p>
        {active ? (
          <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <li>
              Descuento en soles <strong>según cada producto</strong> (
              <Link href="/admin/products" className="underline">
                Productos
              </Link>
              )
            </li>
            <li>
              En las primeras <strong>{active.maxDiscountedUnitsPerSale}</strong>{" "}
              unidades de cada compra
            </li>
            <li>
              Máx. <strong>{active.maxDiscountedSalesPerDay}</strong> compras con
              descuento por día
            </li>
            <li>
              {active.birthdayGiftMaxAmount > 0 ? (
                <>
                  Regalo de cumpleaños hasta{" "}
                  <strong>{formatSoles(active.birthdayGiftMaxAmount)}</strong>
                </>
              ) : (
                "Sin regalo de cumpleaños"
              )}
            </li>
            <li>
              <strong>{active.pointsPerSol}</strong> punto(s) por cada S/ 1
            </li>
          </ul>
        ) : (
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
            Aún no configuraste el descuento: los trabajadores no reciben descuento.
          </p>
        )}
      </div>
      <Button variant={active ? "outline" : "default"} onClick={() => setOpen(true)}>
        <SettingsIcon data-icon="inline-start" />
        {active ? "Cambiar reglas" : "Configurar descuento"}
      </Button>
      <PolicyDialog open={open} onOpenChange={setOpen} active={active} versions={versions} />
    </div>
  );
}

function PolicyDialog({
  open,
  onOpenChange,
  active,
  versions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  active: PolicyView | null;
  versions: PolicyView[];
}) {
  const [isPending, startTransition] = useTransition();
  const [units, setUnits] = useState(String(active?.maxDiscountedUnitsPerSale ?? 3));
  const [perDay, setPerDay] = useState(String(active?.maxDiscountedSalesPerDay ?? 2));
  const [points, setPoints] = useState(String(active?.pointsPerSol ?? 1));
  const [gift, setGift] = useState(String(active?.birthdayGiftMaxAmount ?? 10));

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await updateDiscountPolicy({
        maxDiscountedUnitsPerSale: Number(units),
        maxDiscountedSalesPerDay: Number(perDay),
        pointsPerSol: Number(points),
        birthdayGiftMaxAmount: Number(gift),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Reglas del descuento actualizadas", {
        description: "Las cajas las aplicarán en unos minutos.",
      });
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reglas del descuento para trabajadores</DialogTitle>
          <DialogDescription>
            El monto de descuento (en soles) se configura en cada producto.
            Aquí van los límites, el regalo de cumpleaños y los puntos. Los cambios se guardan como una versión
            nueva: las ventas anteriores conservan la regla con la que se
            cobraron.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="units"
              label="Unidades con descuento por compra"
              hint="Ej. 3: si lleva 5 gaseosas, 3 van con descuento y 2 a precio normal."
              value={units}
              onChange={setUnits}
              step="1"
              min="1"
              max="20"
            />
            <Field
              id="per-day"
              label="Compras con descuento por día"
              hint="Evita que presten su DNI a otras personas."
              value={perDay}
              onChange={setPerDay}
              step="1"
              min="0"
              max="50"
            />
            <Field
              id="gift"
              label="Regalo de cumpleaños hasta (S/)"
              hint="Un producto gratis el día de su cumpleaños, una vez al año. 0 = sin regalo."
              value={gift}
              onChange={setGift}
              step="0.5"
              min="0"
              max="500"
            />
            <Field
              id="points"
              label="Puntos por cada S/ 1"
              hint="Los puntos se suman en cada compra."
              value={points}
              onChange={setPoints}
              step="0.5"
              min="0"
              max="100"
            />
          </div>

          {versions.length > 0 && (
            <details className="rounded-lg border p-3 text-sm">
              <summary className="cursor-pointer font-medium">
                Historial de cambios ({versions.length})
              </summary>
              <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                {versions.map((v) => (
                  <li key={v.createdAt} className="flex justify-between gap-3">
                    <span>
                      {v.maxDiscountedUnitsPerSale} unid./compra ·{" "}
                      {v.maxDiscountedSalesPerDay}/día · regalo{" "}
                      {formatSoles(v.birthdayGiftMaxAmount)} · {v.pointsPerSol} pt/S/1
                    </span>
                    <span className="shrink-0">
                      {dateFormat.format(new Date(v.createdAt))}
                      {v.createdByName ? ` · ${v.createdByName}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando…" : "Guardar reglas"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label,
  hint,
  value,
  onChange,
  ...inputProps
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
} & Omit<React.ComponentProps<"input">, "onChange" | "value">) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        {...inputProps}
      />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
