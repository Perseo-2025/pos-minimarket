"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { reviewCount } from "@/actions/inventory";
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
import { cn } from "@/lib/utils";

export function ReviewCountDialog({
  id,
  productName,
  locationName,
  countedByName,
  expected,
  counted,
}: {
  id: number;
  productName: string;
  locationName: string;
  countedByName: string | null;
  expected: number;
  counted: number;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const delta = counted - expected;

  function decide(approve: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await reviewCount({ id, approve, note });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(
        approve ? "Stock ajustado al conteo" : "Se pidió volver a contar",
      );
      setOpen(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setError(null);
      }}
    >
      <DialogTrigger render={<Button size="sm">Revisar</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{productName}</DialogTitle>
          <DialogDescription>
            {locationName} · contó {countedByName ?? "—"}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Sistema</div>
            <div className="text-2xl font-semibold tabular-nums">{expected}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Contado</div>
            <div className="text-2xl font-semibold tabular-nums">{counted}</div>
          </div>
          <div
            className={cn(
              "rounded-lg border p-3",
              delta < 0 ? "border-destructive/40 bg-destructive/5" : "border-sky-500/40 bg-sky-500/5",
            )}
          >
            <div className="text-xs text-muted-foreground">Diferencia</div>
            <div
              className={cn(
                "text-2xl font-semibold tabular-nums",
                delta < 0 ? "text-destructive" : "text-sky-700 dark:text-sky-400",
              )}
            >
              {delta > 0 ? "+" : ""}
              {delta}
            </div>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">Aprobar</strong> deja el stock como
          se contó. Si dudas del conteo, pide que se{" "}
          <strong className="text-foreground">vuelva a contar</strong>.
        </p>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`review-note-${id}`}>Nota</Label>
          <Input
            id={`review-note-${id}`}
            placeholder="Ej. Se encontraron 2 rotas en el estante"
            maxLength={200}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Obligatoria si pides volver a contar.
          </p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={isPending} onClick={() => decide(false)}>
            Volver a contar
          </Button>
          <Button disabled={isPending} onClick={() => decide(true)}>
            Aprobar ajuste
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
