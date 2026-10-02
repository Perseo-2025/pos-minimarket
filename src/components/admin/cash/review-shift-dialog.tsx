"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { reviewShift } from "@/actions/cash";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ShiftAmounts, ShiftTotals } from "@/domain/entities/cash-shift";
import { shiftDifferences } from "@/domain/services/cash-shift";
import { formatSoles } from "@/lib/money";
import { cn } from "@/lib/utils";

export type ShiftReviewView = {
  id: number;
  cashierName: string;
  totals: ShiftTotals;
  expected: ShiftAmounts;
  counted: ShiftAmounts;
  movements: { id: number; type: "in" | "out"; amount: number; reason: string }[];
  closeNote: string | null;
  // Sales made without internet that haven't arrived yet.
  stillSyncing: number;
  reviewed: boolean;
};

export function Difference({ value }: { value: number }) {
  return (
    <span
      className={cn(
        "font-semibold tabular-nums",
        value < 0 && "text-destructive",
        value > 0 && "text-sky-700 dark:text-sky-400",
        value === 0 && "text-emerald-700 dark:text-emerald-400",
      )}
    >
      {value === 0 ? "Cuadra" : `${value > 0 ? "+" : "−"}${formatSoles(Math.abs(value))}`}
    </span>
  );
}

export function ReviewShiftDialog({ shift }: { shift: ShiftReviewView }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const diff = shiftDifferences(shift.counted, shift.expected);

  function handleReview() {
    setError(null);
    startTransition(async () => {
      const result = await reviewShift({ id: shift.id, note });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(`Caja #${shift.id} revisada`);
      setOpen(false);
    });
  }

  const rows: [string, number][] = [
    ["Monto inicial", shift.totals.openingCash],
    ["Ventas en efectivo", shift.totals.cashSales],
    ["Entradas de dinero", shift.totals.cashIn],
    ["Salidas de dinero", -shift.totals.cashOut],
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant={shift.reviewed ? "outline" : "default"}>
            {shift.reviewed ? "Ver" : "Revisar"}
          </Button>
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Caja #{shift.id} · {shift.cashierName}
          </DialogTitle>
          <DialogDescription>
            Lo que el sistema esperaba contra lo que se contó al cerrar.
          </DialogDescription>
        </DialogHeader>

        {shift.stillSyncing > 0 && (
          <p className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
            Faltan llegar {shift.stillSyncing} ventas de este turno (se hicieron sin
            internet). Los montos esperados aún pueden cambiar.
          </p>
        )}

        <div className="flex flex-col gap-1 text-sm">
          <div className="font-medium">Efectivo</div>
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between text-muted-foreground">
              <span>{label}</span>
              <span className="tabular-nums">
                {value < 0 ? `−${formatSoles(-value)}` : formatSoles(value)}
              </span>
            </div>
          ))}
          <div className="flex justify-between border-t pt-1">
            <span>Debería haber</span>
            <span className="font-medium tabular-nums">{formatSoles(shift.expected.cash)}</span>
          </div>
          <div className="flex justify-between">
            <span>Se contó</span>
            <span className="font-medium tabular-nums">{formatSoles(shift.counted.cash)}</span>
          </div>
          <div className="flex justify-between">
            <span>Diferencia</span>
            <Difference value={diff.cash} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          {(
            [
              ["Yape/Plin", "yape"],
              ["Tarjeta", "card"],
            ] as const
          ).map(([label, key]) => (
            <div key={key} className="rounded-lg border p-3">
              <div className="font-medium">{label}</div>
              <div className="text-muted-foreground tabular-nums">
                Ventas {formatSoles(shift.expected[key])} · Contado{" "}
                {formatSoles(shift.counted[key])}
              </div>
              <Difference value={diff[key]} />
            </div>
          ))}
        </div>

        {shift.movements.length > 0 && (
          <div className="flex flex-col gap-1 text-sm">
            <div className="font-medium">Entradas y salidas</div>
            {shift.movements.map((m) => (
              <div key={m.id} className="flex justify-between gap-3 text-muted-foreground">
                <span className="truncate">
                  {m.type === "in" ? "Entrada" : "Salida"} · {m.reason}
                </span>
                <span className="shrink-0 tabular-nums">
                  {m.type === "in" ? "+" : "−"}
                  {formatSoles(m.amount)}
                </span>
              </div>
            ))}
          </div>
        )}

        {shift.closeNote && (
          <p className="text-sm text-muted-foreground">
            Nota del cajero: {shift.closeNote}
          </p>
        )}

        {!shift.reviewed && (
          <div className="flex flex-col gap-2">
            <Label htmlFor={`shift-note-${shift.id}`}>Nota de la revisión</Label>
            <Input
              id={`shift-note-${shift.id}`}
              maxLength={200}
              placeholder="Opcional. Ej. Se descontó del sueldo / error de vuelto"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        {!shift.reviewed && (
          <DialogFooter>
            <Button disabled={isPending || shift.stillSyncing > 0} onClick={handleReview}>
              {isPending ? "Guardando..." : "Marcar como revisada"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
