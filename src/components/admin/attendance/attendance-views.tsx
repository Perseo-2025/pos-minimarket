import {
  CalendarDaysIcon,
  ClipboardCheckIcon,
  DownloadIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import {
  attendanceReportUseCase,
  listCorrectionsUseCase,
  type PersonReport,
} from "@/application/use-cases/attendance/reports";
import { AuditRangeFilter } from "@/components/admin/audit/audit-range-filter";
import { DataTable, ID_COLUMN, IdCell } from "@/components/admin/data-table";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  ATTENDANCE_CORRECTION_STATUS_LABELS,
  ATTENDANCE_FIELD_LABELS,
  type AttendanceCorrection,
} from "@/domain/entities/attendance";
import { USER_ROLE_LABELS } from "@/domain/entities/user";
import { formatMinutes, monthRange } from "@/domain/services/attendance";
import { STORE_TIME_ZONE } from "@/domain/value-objects/store-time";
import { attendanceDeps } from "@/infrastructure/deps";
import { cn } from "@/lib/utils";
import { DayPicker, MonthPicker, PersonFilter } from "./attendance-filters";
import { DayTable } from "./day-table";
import { StatusLegend } from "./day-status";
import { ReviewCorrectionDialog } from "./review-correction-dialog";

const dateTimeFormat = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: STORE_TIME_ZONE,
});
const timeFormat = new Intl.DateTimeFormat("es-PE", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: STORE_TIME_ZONE,
});

function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  tone?: "warn" | "bad";
}) {
  return (
    <Card
      size="sm"
      className={cn(
        tone === "warn" && value > 0 && "border-amber-500/40",
        tone === "bad" && value > 0 && "border-destructive/40",
      )}
    >
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">{hint}</CardContent>
    </Card>
  );
}

function NoStaff() {
  return (
    <EmptyState
      icon={UsersIcon}
      title="Todavía no hay personal"
      description="Crea usuarios con rol Cajero o Almacenero y asígnales un horario. Cada uno marcará su entrada al iniciar sesión."
      action={
        <Button nativeButton={false} render={<Link href="/admin/users" />}>
          Ir a Usuarios
        </Button>
      }
    />
  );
}

// ---- Hoy ----

export async function TodayView({ today, pending }: { today: string; pending: number }) {
  const reports = await attendanceReportUseCase(attendanceDeps, { from: today, to: today });
  if (reports.length === 0) return <NoStaff />;
  const days = reports.map((r) => r.days[0]);
  const count = (status: string) => days.filter((d) => d.status === status).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label="Trabajando ahora" value={count("working")} hint="Marcaron entrada y aún no salen." />
        <Metric
          label="Llegaron tarde"
          value={days.filter((d) => d.lateMinutes > 0).length}
          hint="Pasada la tolerancia de su horario."
          tone="warn"
        />
        <Metric label="Faltan" value={count("absent")} hint="Tenían horario y no marcaron." tone="bad" />
        <Metric
          label="Sin salida"
          value={count("no_clock_out")}
          hint="Entraron y no marcaron su salida."
          tone="warn"
        />
        <Card size="sm" className={cn(pending > 0 && "border-amber-500/40")}>
          <CardHeader>
            <CardDescription>Correcciones por revisar</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{pending}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs">
            <Link href="/admin/asistencia?vista=correcciones" className="text-primary hover:underline">
              Ver solicitudes
            </Link>
          </CardContent>
        </Card>
      </div>
      <DayTable reports={reports} dateKey={today} />
      <StatusLegend />
    </div>
  );
}

// ---- Por día ----

export async function DayView({ date, today }: { date: string; today: string }) {
  const reports = await attendanceReportUseCase(attendanceDeps, { from: date, to: date });
  return (
    <div className="flex flex-col gap-4">
      <DayPicker value={date} today={today} />
      {reports.length === 0 ? <NoStaff /> : <DayTable reports={reports} dateKey={date} />}
      <StatusLegend />
    </div>
  );
}

// ---- Por mes / Reporte de horas ----

const SUMMARY_COLUMNS = [
  { label: "Persona" },
  { label: "Días trabajados", className: "text-right" },
  { label: "Faltas", className: "text-right" },
  { label: "Tardanzas", className: "text-right" },
  { label: "Salió antes", className: "text-right" },
  { label: "Sin salida", className: "text-right" },
  { label: "Horas trabajadas", className: "text-right" },
  { label: "", className: "text-right" },
];

function SummaryTable({ reports, month }: { reports: PersonReport[]; month: string }) {
  return (
    <DataTable columns={SUMMARY_COLUMNS} isEmpty={reports.length === 0}>
      {reports.map(({ person, totals }) => (
        <TableRow key={person.id}>
          <TableCell>
            <div className="font-medium">{person.name}</div>
            <div className="text-xs text-muted-foreground">
              {USER_ROLE_LABELS[person.role]}
              {!person.isActive && " · desactivado"}
            </div>
          </TableCell>
          <TableCell className="text-right tabular-nums">{totals.daysWorked}</TableCell>
          <TableCell
            className={cn("text-right tabular-nums", totals.absences > 0 && "font-medium text-destructive")}
          >
            {totals.absences}
          </TableCell>
          <TableCell className="text-right tabular-nums">
            {totals.lateCount > 0 ? (
              <span className="font-medium text-amber-700 dark:text-amber-400">
                {totals.lateCount} ({formatMinutes(totals.lateMinutes)})
              </span>
            ) : (
              0
            )}
          </TableCell>
          <TableCell className="text-right tabular-nums">
            {totals.earlyLeaveMinutes > 0 ? formatMinutes(totals.earlyLeaveMinutes) : "—"}
          </TableCell>
          <TableCell
            className={cn(
              "text-right tabular-nums",
              totals.missingClockOut > 0 && "font-medium text-violet-700 dark:text-violet-400",
            )}
          >
            {totals.missingClockOut}
          </TableCell>
          <TableCell className="text-right font-medium tabular-nums">
            {formatMinutes(totals.workedMinutes)}
          </TableCell>
          <TableCell className="text-right">
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link href={`/admin/asistencia/persona/${person.id}?mes=${month}`} />}
            >
              <CalendarDaysIcon data-icon="inline-start" />
              Calendario
            </Button>
          </TableCell>
        </TableRow>
      ))}
    </DataTable>
  );
}

export async function MonthView({ month, currentMonth }: { month: string; currentMonth: string }) {
  const range = monthRange(month);
  const reports = await attendanceReportUseCase(attendanceDeps, range);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthPicker value={month} current={currentMonth} basePath="/admin/asistencia?vista=mes" />
        <Button
          variant="outline"
          nativeButton={false}
          render={<a href={`/api/admin/attendance/export?from=${range.from}&to=${range.to}`} />}
        >
          <DownloadIcon data-icon="inline-start" />
          Exportar CSV
        </Button>
      </div>
      {reports.length === 0 ? <NoStaff /> : <SummaryTable reports={reports} month={month} />}
    </div>
  );
}

export async function RangeView({
  from,
  to,
  today,
  personId,
}: {
  from: string;
  to: string;
  today: string;
  personId: number | undefined;
}) {
  const [all, reports] = await Promise.all([
    attendanceDeps.attendance.listPeople(),
    attendanceReportUseCase(attendanceDeps, { from, to, userId: personId }),
  ]);
  const persona = personId ? `&persona=${personId}` : "";
  const total = reports.reduce((sum, r) => sum + r.totals.workedMinutes, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <AuditRangeFilter
            from={from}
            to={to}
            today={today}
            basePath="/admin/asistencia"
            query={`vista=rango${persona}`}
          />
          <PersonFilter people={all} value={personId} from={from} to={to} />
        </div>
        <Button
          variant="outline"
          nativeButton={false}
          render={<a href={`/api/admin/attendance/export?from=${from}&to=${to}${persona}`} />}
        >
          <DownloadIcon data-icon="inline-start" />
          Exportar CSV
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Del {from} al {to}: {formatMinutes(total)} trabajadas en total. El CSV trae el detalle día
        por día (se abre en Excel).
      </p>
      {reports.length === 0 ? <NoStaff /> : <SummaryTable reports={reports} month={to.slice(0, 7)} />}
    </div>
  );
}

// ---- Correcciones ----

function correctionView(c: AttendanceCorrection) {
  return {
    id: c.id,
    userName: c.userName ?? "—",
    workDate: c.workDate ?? "—",
    fieldLabel: ATTENDANCE_FIELD_LABELS[c.field],
    oldValue: c.oldValue ? timeFormat.format(c.oldValue) : "sin marca",
    newValue: dateTimeFormat.format(c.newValue),
    reason: c.reason,
  };
}

const CORRECTION_TONES = {
  pending: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  approved: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  rejected: "text-muted-foreground",
} as const;

export async function CorrectionsView() {
  const all = await listCorrectionsUseCase(attendanceDeps, undefined);
  if (all.length === 0) {
    return (
      <EmptyState
        icon={ClipboardCheckIcon}
        title="No hay correcciones"
        description="Cuando alguien olvide marcar su salida, al día siguiente dirá a qué hora salió y su pedido aparecerá aquí para que lo apruebes."
      />
    );
  }
  const pending = all.filter((c) => c.status === "pending");
  const done = all.filter((c) => c.status !== "pending");

  const columns = [
    ID_COLUMN,
    { label: "Persona" },
    { label: "Jornada" },
    { label: "Cambio" },
    { label: "Motivo" },
    { label: "Pedido por" },
    { label: "Estado" },
    { label: "", className: "text-right" },
  ];

  const rows = (list: AttendanceCorrection[]) =>
    list.map((c) => {
      const view = correctionView(c);
      return (
        <TableRow key={c.id}>
          <IdCell id={c.id} />
          <TableCell className="font-medium">{view.userName}</TableCell>
          <TableCell className="text-sm tabular-nums">
            {c.attendanceId ? (
              <Link href={`/admin/asistencia/jornada/${c.attendanceId}`} className="hover:underline">
                {view.workDate}
              </Link>
            ) : (
              view.workDate
            )}
          </TableCell>
          <TableCell className="text-sm tabular-nums">
            {view.fieldLabel}: {view.oldValue} → <span className="font-medium">{view.newValue}</span>
          </TableCell>
          <TableCell className="max-w-56 text-sm text-muted-foreground">{c.reason}</TableCell>
          <TableCell className="text-sm">
            {c.requestedByName}
            <div className="text-xs text-muted-foreground">{dateTimeFormat.format(c.createdAt)}</div>
          </TableCell>
          <TableCell>
            <Badge variant="outline" className={CORRECTION_TONES[c.status]}>
              {ATTENDANCE_CORRECTION_STATUS_LABELS[c.status]}
            </Badge>
            {c.reviewedByName && (
              <div className="mt-1 text-xs text-muted-foreground">
                {c.reviewedByName}
                {c.reviewNote ? ` · ${c.reviewNote}` : ""}
              </div>
            )}
          </TableCell>
          <TableCell className="text-right">
            {c.status === "pending" && <ReviewCorrectionDialog correction={view} />}
          </TableCell>
        </TableRow>
      );
    });

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">Por revisar</h2>
        <DataTable columns={columns} isEmpty={pending.length === 0} emptyMessage="Nada pendiente.">
          {rows(pending)}
        </DataTable>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">Historial</h2>
        <p className="text-sm text-muted-foreground">
          Toda corrección queda registrada: quién la pidió, quién la aprobó y el valor original.
        </p>
        <DataTable columns={columns} isEmpty={done.length === 0} emptyMessage="Sin historial.">
          {rows(done)}
        </DataTable>
      </section>
    </div>
  );
}
