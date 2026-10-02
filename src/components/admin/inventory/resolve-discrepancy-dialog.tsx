"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { resolveDiscrepancy } from "@/actions/inventory";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { DiscrepancyResolution } from "@/domain/services/receiving";

const MISSING: { value: DiscrepancyResolution; label: string; help: string }[] = [
  {
    value: "replenished",
    label: "El proveedor lo trajo",
    help: "Las unidades entran ahora al Almacén.",
  },
  {
    value: "credited",
    label: "Nos lo descontó",
    help: "Nota de crédito o descuento en la próxima factura. No cambia el stock.",
  },
  {
    value: "written_off",
    label: "Se asume la pérdida",
    help: "No se recupera. No cambia el stock.",
  },
];

const EXTRA: { value: DiscrepancyResolution; label: string; help: string }[] = [
  {
    value: "kept",
    label: "Nos quedamos",
    help: "Las unidades extra ya están en el Almacén.",
  },
  {
    value: "returned",
    label: "Se devolvió",
    help: "Las unidades extra salen del Almacén.",
  },
];

export function ResolveDiscrepancyDialog({
  id,
  productName,
  units,
  tracksExpiry,
}: {
  id: number;
  productName: string;
  // < 0 missing, > 0 extra.
  units: number;
  tracksExpiry: boolean;
}) {
  const options = units < 0 ? MISSING : EXTRA;
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<DiscrepancyResolution>(options[0].value);
  const [note, setNote] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const chosen = options.find((o) => o.value === status);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await resolveDiscrepancy({ id, status, note, expiresAt });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Diferencia resuelta");
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
      <DialogTrigger render={<Button size="sm">Resolver</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {units < 0 ? `Faltaron ${-units}` : `Sobraron ${units}`} · {productName}
          </DialogTitle>
          <DialogDescription>¿Qué pasó con estas unidades?</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <ToggleGroup
            aria-label="Qué pasó"
            value={[status]}
            onValueChange={(next) => {
              const [choice] = next as DiscrepancyResolution[];
              if (choice) setStatus(choice);
            }}
            variant="outline"
            spacing={1}
            className="flex w-full flex-col items-stretch"
          >
            {options.map((option) => (
              <ToggleGroupItem
                key={option.value}
                value={option.value}
                className="justify-start aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
              >
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {chosen && <p className="text-sm text-muted-foreground">{chosen.help}</p>}

          {status === "replenished" && tracksExpiry && (
            <div className="flex flex-col gap-2">
              <Label htmlFor={`gap-expires-${id}`}>Vence el</Label>
              <Input
                id={`gap-expires-${id}`}
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                required
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor={`gap-note-${id}`}>Nota</Label>
            <Input
              id={`gap-note-${id}`}
              placeholder="Opcional. Ej. Nota de crédito NC01-0045"
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

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
