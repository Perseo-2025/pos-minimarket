"use client";

import { CopyIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveSchedule } from "@/actions/attendance";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DEFAULT_TOLERANCE_MIN, type WorkSchedule } from "@/domain/entities/attendance";
import { WEEK_ORDER, WEEKDAY_LABELS } from "@/domain/services/attendance";
import { cn } from "@/lib/utils";

type DayRow = {
  weekday: number;
  works: boolean;
  startTime: string;
  endTime: string;
  toleranceMin: string;
};

function initialRows(schedules: WorkSchedule[]): DayRow[] {
  return WEEK_ORDER.map((weekday) => {
    const day = schedules.find((s) => s.weekday === weekday);
    return {
      weekday,
      works: Boolean(day),
      startTime: day?.startTime ?? "07:00",
      endTime: day?.endTime ?? "15:00",
      toleranceMin: String(day?.toleranceMin ?? DEFAULT_TOLERANCE_MIN),
    };
  });
}

// One person's week: which days they work, from when to when, and how many
// minutes of tolerance before it counts as late.
export function ScheduleEditor({
  person,
  schedules,
}: {
  person: { id: number; name: string; roleLabel: string };
  schedules: WorkSchedule[];
}) {
  const [rows, setRows] = useState(() => initialRows(schedules));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const update = (weekday: number, patch: Partial<DayRow>) =>
    setRows((current) => current.map((r) => (r.weekday === weekday ? { ...r, ...patch } : r)));

  // Monday's hours to Monday–Saturday (the usual week in the store).
  function copyMonday() {
    const monday = rows.find((r) => r.weekday === 1)!;
    setRows((current) =>
      current.map((r) =>
        r.weekday >= 1 && r.weekday <= 6
          ? { ...monday, weekday: r.weekday, works: true }
          : r,
      ),
    );
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await saveSchedule({
        userId: person.id,
        days: rows
          .filter((r) => r.works)
          .map(({ weekday, startTime, endTime, toleranceMin }) => ({
            weekday,
            startTime,
            endTime,
            toleranceMin,
          })),
      });
      if (!result.ok) return setError(result.error);
      toast.success(`Horario de ${person.name} guardado`);
    });
  }

  const workDays = rows.filter((r) => r.works).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{person.name}</CardTitle>
        <CardDescription>
          {person.roleLabel} · {workDays === 0 ? "sin horario" : `${workDays} días a la semana`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-[minmax(7rem,1fr)_repeat(3,minmax(0,1fr))] items-center gap-2 text-xs font-medium text-muted-foreground uppercase">
          <span>Día</span>
          <span>Entrada</span>
          <span>Salida</span>
          <span>Tolerancia (min)</span>
        </div>
        {rows.map((row) => (
          <div
            key={row.weekday}
            className={cn(
              "grid grid-cols-[minmax(7rem,1fr)_repeat(3,minmax(0,1fr))] items-center gap-2",
              !row.works && "opacity-60",
            )}
          >
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={row.works}
                onChange={(e) => update(row.weekday, { works: e.target.checked })}
              />
              {WEEKDAY_LABELS[row.weekday]}
            </label>
            {row.works ? (
              <>
                <Input
                  type="time"
                  aria-label={`Entrada ${WEEKDAY_LABELS[row.weekday]}`}
                  value={row.startTime}
                  onChange={(e) => update(row.weekday, { startTime: e.target.value })}
                />
                <Input
                  type="time"
                  aria-label={`Salida ${WEEKDAY_LABELS[row.weekday]}`}
                  value={row.endTime}
                  onChange={(e) => update(row.weekday, { endTime: e.target.value })}
                />
                <Input
                  type="number"
                  min={0}
                  max={120}
                  aria-label={`Tolerancia ${WEEKDAY_LABELS[row.weekday]}`}
                  value={row.toleranceMin}
                  onChange={(e) => update(row.weekday, { toleranceMin: e.target.value })}
                />
              </>
            ) : (
              <span className="col-span-3 text-sm text-muted-foreground">Libre</span>
            )}
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          Si la salida es antes que la entrada (ej. 22:00 a 06:00), el turno termina al día
          siguiente. Cambiar el horario no cambia las tardanzas ya registradas.
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-between gap-2">
          <Button variant="outline" onClick={copyMonday} disabled={isPending}>
            <CopyIcon data-icon="inline-start" />
            Copiar lunes a lunes–sábado
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Guardando..." : "Guardar horario"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
