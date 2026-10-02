"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { correctAttendance } from "@/actions/attendance";
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
import type { AttendanceField } from "@/domain/entities/attendance";
import { STORE_UTC_OFFSET } from "@/domain/value-objects/store-time";

// The admin fixes a mark with a reason. The original value is kept and the
// workday shows "corrected" from then on.
export function CorrectMarkDialog({
  attendanceId,
  userName,
  // Store date and HH:MM of the current marks (exit may be missing).
  clockIn,
  clockOut,
}: {
  attendanceId: number;
  userName: string;
  clockIn: { date: string; time: string };
  clockOut: { date: string; time: string } | null;
}) {
  const [open, setOpen] = useState(false);
  const [field, setField] = useState<AttendanceField>(clockOut ? "clock_in" : "clock_out");
  const current = field === "clock_in" ? clockIn : clockOut;
  const [date, setDate] = useState(current?.date ?? clockIn.date);
  const [time, setTime] = useState(current?.time ?? "");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function chooseField(next: AttendanceField) {
    setField(next);
    const value = next === "clock_in" ? clockIn : clockOut;
    setDate(value?.date ?? clockIn.date);
    setTime(value?.time ?? "");
  }

  function handleSave() {
    if (!time) return setError("Escribe la hora");
    setError(null);
    startTransition(async () => {
      const result = await correctAttendance({
        attendanceId,
        field,
        newValue: `${date}T${time}:00${STORE_UTC_OFFSET}`,
        reason,
      });
      if (!result.ok) return setError(result.error);
      toast.success("Marca corregida");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline">Corregir marca</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Corregir marca · {userName}</DialogTitle>
          <DialogDescription>
            La marca original no se borra: queda en el historial junto con tu corrección y el
            motivo.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Qué marca corregir">
          {(
            [
              ["clock_in", "Entrada"],
              ["clock_out", "Salida"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              variant={field === value ? "secondary" : "outline"}
              aria-pressed={field === value}
              onClick={() => chooseField(value)}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`correct-date-${attendanceId}`}>Fecha</Label>
            <Input
              id={`correct-date-${attendanceId}`}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`correct-time-${attendanceId}`}>Hora</Label>
            <Input
              id={`correct-time-${attendanceId}`}
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`correct-reason-${attendanceId}`}>Motivo</Label>
          <Input
            id={`correct-reason-${attendanceId}`}
            maxLength={200}
            placeholder="Ej. Se olvidó de marcar, lo confirmé con la cámara"
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
            {isPending ? "Guardando..." : "Guardar corrección"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
