"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { reviewCorrection } from "@/actions/attendance";
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

export type CorrectionReviewView = {
  id: number;
  userName: string;
  workDate: string;
  fieldLabel: string;
  oldValue: string;
  newValue: string;
  reason: string;
};

// "Juan dice que el lunes salió a las 15:00": approve (the workday is fixed)
// or reject (it stays without exit). Either way it's recorded.
export function ReviewCorrectionDialog({ correction }: { correction: CorrectionReviewView }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleReview(approve: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await reviewCorrection({ id: correction.id, approve, note });
      if (!result.ok) return setError(result.error);
      toast.success(approve ? "Corrección aprobada" : "Corrección rechazada");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">Revisar</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Corrección de {correction.userName}</DialogTitle>
          <DialogDescription>
            {correction.workDate} · {correction.fieldLabel}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border p-3">
            <div className="text-muted-foreground">Registrado</div>
            <div className="text-lg font-semibold tabular-nums">{correction.oldValue}</div>
          </div>
          <div className="rounded-lg border border-amber-500/40 p-3">
            <div className="text-muted-foreground">Pide cambiar a</div>
            <div className="text-lg font-semibold tabular-nums">{correction.newValue}</div>
          </div>
        </div>
        <p className="text-sm">
          <span className="text-muted-foreground">Motivo:</span> {correction.reason}
        </p>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`correction-note-${correction.id}`}>Nota</Label>
          <Input
            id={`correction-note-${correction.id}`}
            maxLength={200}
            placeholder="Opcional. Ej. Lo confirmé con la cámara"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" disabled={isPending} onClick={() => handleReview(false)}>
            Rechazar
          </Button>
          <Button disabled={isPending} onClick={() => handleReview(true)}>
            Aprobar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
