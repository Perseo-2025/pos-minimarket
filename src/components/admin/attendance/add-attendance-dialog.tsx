"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addAttendance } from "@/actions/attendance";
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

// A workday the person couldn't mark (the tablet broke, no battery). It
// stays marked as "added by the admin", with the reason, forever.
export function AddAttendanceDialog({
  person,
  workDate,
  defaultIn,
  defaultOut,
}: {
  person: { id: number; name: string };
  workDate: string;
  defaultIn: string;
  defaultOut: string;
}) {
  const [open, setOpen] = useState(false);
  const [clockIn, setClockIn] = useState(defaultIn);
  const [clockOut, setClockOut] = useState(defaultOut);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await addAttendance({
        userId: person.id,
        workDate,
        clockIn,
        clockOut,
        reason,
      });
      if (!result.ok) return setError(result.error);
      toast.success(`Jornada de ${person.name} agregada`);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="ghost">Agregar jornada</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar jornada · {person.name}</DialogTitle>
          <DialogDescription>
            Solo si la persona trabajó y no pudo marcar ({workDate}). Quedará registrado que lo
            agregaste tú y por qué.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`add-in-${person.id}`}>Entrada</Label>
            <Input
              id={`add-in-${person.id}`}
              type="time"
              value={clockIn}
              onChange={(e) => setClockIn(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`add-out-${person.id}`}>Salida</Label>
            <Input
              id={`add-out-${person.id}`}
              type="time"
              value={clockOut}
              onChange={(e) => setClockOut(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`add-reason-${person.id}`}>Motivo</Label>
          <Input
            id={`add-reason-${person.id}`}
            maxLength={200}
            placeholder="Ej. Se malogró la tablet, lo vi trabajar"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button disabled={isPending} onClick={handleSave}>
            {isPending ? "Guardando..." : "Agregar jornada"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
