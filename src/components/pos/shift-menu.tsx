"use client";

import {
  ArrowDownToLineIcon,
  ArrowUpFromLineIcon,
  LockIcon,
  WalletIcon,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { LocalShift } from "@/infrastructure/offline/types";
import { formatSoles } from "@/lib/money";

type View = "menu" | "in" | "out" | "close";

const timeFormat = new Intl.DateTimeFormat("es-PE", {
  hour: "2-digit",
  minute: "2-digit",
});

const toAmount = (value: string) => Math.round(Number(value) * 100) / 100;

// "Caja abierta 7:02": money in / out during the shift, and "Cerrar caja",
// where the cashier writes what they count (never what the system expects).
export function ShiftMenu({
  shift,
  onMove,
  onClose,
}: {
  shift: LocalShift;
  onMove: (type: "in" | "out", amount: number, reason: string) => Promise<void>;
  onClose: (
    counted: { cash: number; yape: number; card: number },
    note: string,
  ) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("menu");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [cash, setCash] = useState("");
  const [yape, setYape] = useState("");
  const [card, setCard] = useState("");
  const [note, setNote] = useState("");

  function reset(next: View) {
    setView(next);
    setError(null);
    setAmount("");
    setReason("");
  }

  function submitMovement(type: "in" | "out") {
    if (!(toAmount(amount) > 0)) return setError("Escribe el monto");
    if (reason.trim().length < 3) return setError("Escribe el motivo");
    setError(null);
    startTransition(async () => {
      try {
        await onMove(type, toAmount(amount), reason.trim());
        toast.success(
          `${type === "in" ? "Entrada" : "Salida"} de ${formatSoles(toAmount(amount))} registrada`,
        );
        reset("menu");
        setOpen(false);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  function submitClose() {
    const values = [cash, yape, card];
    if (values.some((v) => v === "" || Number(v) < 0)) {
      return setError("Escribe los tres montos (pon 0 si no hubo)");
    }
    setError(null);
    startTransition(async () => {
      try {
        await onClose(
          { cash: toAmount(cash), yape: toAmount(yape), card: toAmount(card) },
          note.trim(),
        );
        toast.success("Caja cerrada. ¡Gracias por tu turno!", {
          description: "El administrador revisará el cierre.",
        });
        setOpen(false);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          reset("menu");
          setOpen(true);
        }}
      >
        <WalletIcon data-icon="inline-start" />
        <span className="hidden sm:inline">Caja abierta</span>{" "}
        {timeFormat.format(new Date(shift.openedAt))}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {view === "menu" && "Caja"}
              {view === "in" && "Entrada de dinero"}
              {view === "out" && "Salida de dinero"}
              {view === "close" && "Cerrar caja"}
            </SheetTitle>
            <SheetDescription>
              {view === "menu" &&
                `Abierta a las ${timeFormat.format(new Date(shift.openedAt))} con ${formatSoles(shift.openingCash)} · ${shift.salesCount} ventas`}
              {view === "in" && "Dinero que pones en el cajón (ej. sencillo)."}
              {view === "out" &&
                "Dinero que sacas del cajón (ej. pago al contado a un proveedor)."}
              {view === "close" &&
                "Cuenta lo que hay y escríbelo. El administrador compara con el sistema."}
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-4 px-4">
            {view === "menu" && (
              <>
                <Button variant="outline" size="lg" onClick={() => reset("in")}>
                  <ArrowDownToLineIcon data-icon="inline-start" />
                  Entrada de dinero
                </Button>
                <Button variant="outline" size="lg" onClick={() => reset("out")}>
                  <ArrowUpFromLineIcon data-icon="inline-start" />
                  Salida de dinero
                </Button>
                <Button size="lg" onClick={() => reset("close")}>
                  <LockIcon data-icon="inline-start" />
                  Cerrar caja
                </Button>
              </>
            )}

            {(view === "in" || view === "out") && (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="movement-amount">Monto (S/)</Label>
                  <Input
                    id="movement-amount"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.10"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="movement-reason">Motivo</Label>
                  <Input
                    id="movement-reason"
                    maxLength={120}
                    placeholder={
                      view === "out"
                        ? "Ej. Pago a Backus factura F020-123"
                        : "Ej. Sencillo traído por el dueño"
                    }
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>
              </>
            )}

            {view === "close" && (
              <>
                {[
                  ["close-cash", "Efectivo contado en el cajón (S/)", cash, setCash],
                  ["close-yape", "Yape/Plin según tu celular (S/)", yape, setYape],
                  ["close-card", "Tarjeta según el voucher (S/)", card, setCard],
                ].map(([id, label, value, setter]) => (
                  <div key={id as string} className="flex flex-col gap-2">
                    <Label htmlFor={id as string}>{label as string}</Label>
                    <Input
                      id={id as string}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.10"
                      value={value as string}
                      onChange={(e) => (setter as (v: string) => void)(e.target.value)}
                    />
                  </div>
                ))}
                <div className="flex flex-col gap-2">
                  <Label htmlFor="close-note">Nota</Label>
                  <Input
                    id="close-note"
                    maxLength={200}
                    placeholder="Opcional. Ej. Un billete de S/ 20 dudoso"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
              </>
            )}

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            {view !== "menu" && (
              <div className="flex justify-between gap-2">
                <Button variant="ghost" onClick={() => reset("menu")} disabled={isPending}>
                  Volver
                </Button>
                <Button
                  disabled={isPending}
                  onClick={() =>
                    view === "close" ? submitClose() : submitMovement(view as "in" | "out")
                  }
                >
                  {isPending
                    ? "Guardando..."
                    : view === "close"
                      ? "Cerrar caja"
                      : "Registrar"}
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
