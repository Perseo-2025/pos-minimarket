import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  CloudOffIcon,
  LogInIcon,
  LogOutIcon,
  PencilLineIcon,
  TriangleAlertIcon,
  UserPlusIcon,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { attendanceHistoryUseCase } from "@/application/use-cases/attendance/reports";
import { idSchema } from "@/application/validation/id";
import { storeHhmm } from "@/components/attendance/time-format";
import { CorrectMarkDialog } from "@/components/admin/attendance/correct-mark-dialog";
import { ReviewCorrectionDialog } from "@/components/admin/attendance/review-correction-dialog";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ATTENDANCE_FIELD_LABELS } from "@/domain/entities/attendance";
import { formatMinutes, workedMinutes } from "@/domain/services/attendance";
import { STORE_TIME_ZONE, storeDateKey } from "@/domain/value-objects/store-time";
import { attendanceDeps } from "@/infrastructure/deps";
import { cn } from "@/lib/utils";

const dateTimeFormat = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "short",
  timeStyle: "medium",
  timeZone: STORE_TIME_ZONE,
});
const timeFormat = new Intl.DateTimeFormat("es-PE", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: STORE_TIME_ZONE,
});
const dt = (value: Date | null) => (value ? dateTimeFormat.format(value) : "—");

type TimelineEntry = {
  at: Date;
  icon: typeof LogInIcon;
  title: string;
  detail: React.ReactNode;
  tone?: "warn" | "bad" | "ok";
};

// One workday with everything stored about it: the effective times, what
// the device said, when it reached the server, and every correction.
export default async function AttendanceDetailPage({
  params,
}: PageProps<"/admin/asistencia/jornada/[id]">) {
  const id = idSchema.safeParse((await params).id);
  if (!id.success) notFound();
  const history = await attendanceHistoryUseCase(attendanceDeps, id.data);
  if (!history) notFound();
  const { record, corrections } = history;

  const timeline: TimelineEntry[] = [];
  if (record.createdByName) {
    timeline.push({
      at: record.createdAt,
      icon: UserPlusIcon,
      title: `Jornada agregada por ${record.createdByName}`,
      detail: "La persona no marcó; el administrador registró la jornada a mano.",
      tone: "warn",
    });
  } else {
    timeline.push({
      at: record.clockInReceivedAt,
      icon: LogInIcon,
      title: "Marcó entrada",
      detail: (
        <>
          Hora en el equipo: {dt(record.clockInDeviceAt)} · llegó al servidor:{" "}
          {dt(record.clockInReceivedAt)}
        </>
      ),
    });
    if (record.clockOutReceivedAt) {
      timeline.push({
        at: record.clockOutReceivedAt,
        icon: LogOutIcon,
        title: "Marcó salida",
        detail: (
          <>
            Hora en el equipo: {dt(record.clockOutDeviceAt)} · llegó al servidor:{" "}
            {dt(record.clockOutReceivedAt)}
          </>
        ),
      });
    }
  }
  for (const c of corrections) {
    const change = (
      <>
        {ATTENDANCE_FIELD_LABELS[c.field]}: {c.oldValue ? dt(c.oldValue) : "sin marca"} →{" "}
        <span className="font-medium text-foreground">{dt(c.newValue)}</span> · Motivo: {c.reason}
      </>
    );
    const direct = c.requestedById !== record.userId;
    timeline.push({
      at: c.createdAt,
      icon: PencilLineIcon,
      title: direct
        ? `${c.requestedByName} corrigió la marca`
        : `${c.requestedByName} pidió corregir su marca`,
      detail: change,
      tone: "warn",
    });
    if (c.reviewedAt && !direct) {
      timeline.push({
        at: c.reviewedAt,
        icon: PencilLineIcon,
        title: `${c.reviewedByName} ${c.status === "approved" ? "aprobó" : "rechazó"} la corrección`,
        detail: c.reviewNote ?? "Sin nota.",
        tone: c.status === "approved" ? "ok" : "bad",
      });
    }
  }
  timeline.sort((a, b) => a.at.getTime() - b.at.getTime());

  const pending = corrections.filter((c) => c.status === "pending");
  const worked = record.clockOutAt ? workedMinutes(record.clockInAt, record.clockOutAt) : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Jornada #${record.id} · ${record.userName}`}
        description={`Fecha ${record.workDate}. Las marcas originales no se borran nunca.`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={`/admin/asistencia?vista=dia&fecha=${record.workDate}`} />}
            >
              <ArrowLeftIcon data-icon="inline-start" />
              Ese día
            </Button>
            <Button
              variant="outline"
              nativeButton={false}
              render={
                <Link
                  href={`/admin/asistencia/persona/${record.userId}?mes=${record.workDate.slice(0, 7)}`}
                />
              }
            >
              <CalendarDaysIcon data-icon="inline-start" />
              Su mes
            </Button>
            <CorrectMarkDialog
              attendanceId={record.id}
              userName={record.userName}
              clockIn={{ date: storeDateKey(record.clockInAt), time: storeHhmm(record.clockInAt) }}
              clockOut={
                record.clockOutAt
                  ? { date: storeDateKey(record.clockOutAt), time: storeHhmm(record.clockOutAt) }
                  : null
              }
            />
          </div>
        }
      />

      {(record.timeSuspicious || record.offline || record.isCorrected) && (
        <div className="flex flex-col gap-2">
          {record.timeSuspicious && (
            <p className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
              Hora dudosa: el reloj del equipo estaba desfasado más de 5 minutos o fue atrasado. Compara
              la hora del equipo con la hora en que llegó al servidor.
            </p>
          )}
          {record.offline && (
            <p className="flex items-start gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
              <CloudOffIcon className="mt-0.5 size-4 shrink-0" />
              Se marcó sin internet: la hora es la del equipo, corregida según su reloj al
              sincronizar.
            </p>
          )}
          {record.isCorrected && (
            <p className="flex items-start gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
              <PencilLineIcon className="mt-0.5 size-4 shrink-0" />
              Esta jornada fue corregida o agregada por un administrador. Mira el historial abajo.
            </p>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Entrada", timeFormat.format(record.clockInAt)],
          ["Salida", record.clockOutAt ? timeFormat.format(record.clockOutAt) : "Sin salida"],
          ["Horas", worked === null ? "—" : formatMinutes(worked)],
          [
            "Horario",
            record.scheduledStart && record.scheduledEnd
              ? `${timeFormat.format(record.scheduledStart)} – ${timeFormat.format(record.scheduledEnd)}`
              : "Sin horario",
          ],
        ].map(([label, value]) => (
          <Card key={label} size="sm">
            <CardHeader>
              <div className="text-sm text-muted-foreground">{label}</div>
              <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        {record.lateMinutes > 0 && (
          <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400">
            Tardanza {record.lateMinutes} min
          </Badge>
        )}
        {record.earlyLeaveMinutes > 0 && (
          <Badge variant="outline">Salió {record.earlyLeaveMinutes} min antes</Badge>
        )}
        {record.toleranceMin !== null && (
          <Badge variant="outline" className="text-muted-foreground">
            Tolerancia {record.toleranceMin} min
          </Badge>
        )}
      </div>

      {pending.length > 0 && (
        <Card className="border-amber-500/40">
          <CardHeader>
            <CardTitle>Corrección por revisar</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {pending.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <span>
                  {c.requestedByName} pide: {ATTENDANCE_FIELD_LABELS[c.field]} a las{" "}
                  <span className="font-medium">{timeFormat.format(c.newValue)}</span> · {c.reason}
                </span>
                <ReviewCorrectionDialog
                  correction={{
                    id: c.id,
                    userName: record.userName,
                    workDate: record.workDate,
                    fieldLabel: ATTENDANCE_FIELD_LABELS[c.field],
                    oldValue: c.oldValue ? timeFormat.format(c.oldValue) : "sin marca",
                    newValue: dateTimeFormat.format(c.newValue),
                    reason: c.reason,
                  }}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">Historial</h2>
        <ol className="flex flex-col gap-0 border-l pl-4">
          {timeline.map((entry, index) => (
            <li key={index} className="relative pb-5 last:pb-0">
              <span
                className={cn(
                  "absolute top-0.5 -left-[1.6rem] flex size-6 items-center justify-center rounded-full border bg-background",
                  entry.tone === "warn" && "border-amber-500/50 text-amber-700 dark:text-amber-400",
                  entry.tone === "bad" && "border-destructive/50 text-destructive",
                  entry.tone === "ok" && "border-emerald-500/50 text-emerald-700 dark:text-emerald-400",
                )}
              >
                <entry.icon className="size-3.5" aria-hidden />
              </span>
              <div className="text-sm font-medium">
                {entry.title}
                <span className="ml-2 text-xs font-normal text-muted-foreground tabular-nums">
                  {dateTimeFormat.format(entry.at)}
                </span>
              </div>
              <div className="text-sm text-muted-foreground">{entry.detail}</div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
