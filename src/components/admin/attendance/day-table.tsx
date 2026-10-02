import Link from "next/link";
import type { PersonReport } from "@/application/use-cases/attendance/reports";
import { DataTable } from "@/components/admin/data-table";
import { storeHhmm } from "@/components/attendance/time-format";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { USER_ROLE_LABELS } from "@/domain/entities/user";
import { formatMinutes } from "@/domain/services/attendance";
import { STORE_TIME_ZONE } from "@/domain/value-objects/store-time";
import { AddAttendanceDialog } from "./add-attendance-dialog";
import { DayStatusBadge, MarkFlags } from "./day-status";

const timeFormat = new Intl.DateTimeFormat("es-PE", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: STORE_TIME_ZONE,
});
const time = (value: Date | null) => (value ? timeFormat.format(value) : "—");

const COLUMNS = [
  { label: "Persona" },
  { label: "Horario" },
  { label: "Entrada" },
  { label: "Salida" },
  { label: "Horas", className: "text-right" },
  { label: "Tardanza", className: "text-right" },
  { label: "Salió antes", className: "text-right" },
  { label: "Estado" },
  { label: "", className: "text-right" },
];

// One row per person for one date: what they marked against their schedule.
// Several workdays the same date are listed one under the other.
export function DayTable({ reports, dateKey }: { reports: PersonReport[]; dateKey: string }) {
  return (
    <DataTable
      columns={COLUMNS}
      isEmpty={reports.length === 0}
      emptyMessage="No hay personal con rol de cajero o almacenero."
    >
      {reports.map(({ person, days }) => {
        const day = days.find((d) => d.dateKey === dateKey)!;
        return (
          <TableRow key={person.id}>
            <TableCell>
              <Link
                href={`/admin/asistencia/persona/${person.id}?mes=${dateKey.slice(0, 7)}`}
                className="font-medium hover:underline"
              >
                {person.name}
              </Link>
              <div className="text-xs text-muted-foreground">{USER_ROLE_LABELS[person.role]}</div>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground tabular-nums">
              {day.shift ? `${time(day.shift.start)} – ${time(day.shift.end)}` : "Libre"}
            </TableCell>
            <TableCell className="text-sm tabular-nums">
              {day.records.length === 0
                ? "—"
                : day.records.map((r) => <div key={r.id}>{time(r.clockInAt)}</div>)}
            </TableCell>
            <TableCell className="text-sm tabular-nums">
              {day.records.length === 0
                ? "—"
                : day.records.map((r) => <div key={r.id}>{time(r.clockOutAt)}</div>)}
            </TableCell>
            <TableCell className="text-right text-sm tabular-nums">
              {day.workedMinutes > 0 ? formatMinutes(day.workedMinutes) : "—"}
            </TableCell>
            <TableCell className="text-right text-sm tabular-nums">
              {day.lateMinutes > 0 ? (
                <span className="font-medium text-amber-700 dark:text-amber-400">
                  {day.lateMinutes} min
                </span>
              ) : (
                "—"
              )}
            </TableCell>
            <TableCell className="text-right text-sm tabular-nums">
              {day.earlyLeaveMinutes > 0 ? `${day.earlyLeaveMinutes} min` : "—"}
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <DayStatusBadge status={day.status} />
                <MarkFlags
                  corrected={day.corrected}
                  offline={day.offline}
                  suspicious={day.suspicious}
                />
              </div>
            </TableCell>
            <TableCell className="text-right">
              <div className="flex flex-col items-end gap-1">
                {day.records.map((r, index) => (
                  <Button
                    key={r.id}
                    size="sm"
                    variant="outline"
                    nativeButton={false}
                    render={<Link href={`/admin/asistencia/jornada/${r.id}`} />}
                  >
                    Ver{day.records.length > 1 ? ` ${index + 1}` : ""}
                  </Button>
                ))}
                {day.status === "absent" && (
                  <AddAttendanceDialog
                    person={{ id: person.id, name: person.name }}
                    workDate={dateKey}
                    defaultIn={day.shift ? storeHhmm(day.shift.start) : ""}
                    defaultOut={day.shift ? storeHhmm(day.shift.end) : ""}
                  />
                )}
              </div>
            </TableCell>
          </TableRow>
        );
      })}
    </DataTable>
  );
}
