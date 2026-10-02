import { ArrowLeftIcon, DownloadIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { attendanceReportUseCase } from "@/application/use-cases/attendance/reports";
import { idSchema } from "@/application/validation/id";
import { MonthPicker } from "@/components/admin/attendance/attendance-filters";
import {
  DAY_STATUS_CELLS,
  MarkFlags,
  StatusLegend,
} from "@/components/admin/attendance/day-status";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { USER_ROLE_LABELS } from "@/domain/entities/user";
import {
  DAY_STATUS_LABELS,
  formatMinutes,
  monthGrid,
  monthRange,
  WEEK_ORDER,
  WEEKDAY_SHORT,
} from "@/domain/services/attendance";
import { STORE_TIME_ZONE, storeDateKey } from "@/domain/value-objects/store-time";
import { attendanceDeps } from "@/infrastructure/deps";
import { cn } from "@/lib/utils";

const MONTH_PATTERN = /^\d{4}-\d{2}$/;
const monthTitle = new Intl.DateTimeFormat("es-PE", {
  month: "long",
  year: "numeric",
  timeZone: STORE_TIME_ZONE,
});
const timeFormat = new Intl.DateTimeFormat("es-PE", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: STORE_TIME_ZONE,
});

// One person's month at a glance: each day colored by what happened, and
// each day opens the workday with its full audit trail.
export default async function PersonMonthPage({
  params,
  searchParams,
}: PageProps<"/admin/asistencia/persona/[userId]">) {
  const id = idSchema.safeParse((await params).userId);
  if (!id.success) notFound();
  const { mes } = await searchParams;
  const currentMonth = storeDateKey(new Date()).slice(0, 7);
  const month =
    typeof mes === "string" && MONTH_PATTERN.test(mes) && mes <= currentMonth ? mes : currentMonth;

  const [report] = await attendanceReportUseCase(attendanceDeps, {
    ...monthRange(month),
    userId: id.data,
  });
  if (!report) notFound();
  const { person, days, totals } = report;
  const byDate = new Map(days.map((d) => [d.dateKey, d]));
  const range = monthRange(month);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={person.name}
        description={`${USER_ROLE_LABELS[person.role]} · asistencia de ${monthTitle.format(new Date(`${month}-15T12:00:00Z`))}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={`/admin/asistencia?vista=mes&mes=${month}`} />}
            >
              <ArrowLeftIcon data-icon="inline-start" />
              Todo el personal
            </Button>
            <Button
              variant="outline"
              nativeButton={false}
              render={
                <a
                  href={`/api/admin/attendance/export?from=${range.from}&to=${range.to}&persona=${person.id}`}
                />
              }
            >
              <DownloadIcon data-icon="inline-start" />
              CSV
            </Button>
          </div>
        }
      />

      <MonthPicker
        value={month}
        current={currentMonth}
        basePath={`/admin/asistencia/persona/${person.id}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Horas trabajadas", formatMinutes(totals.workedMinutes)],
          ["Días trabajados", String(totals.daysWorked)],
          [
            "Tardanzas",
            totals.lateCount > 0
              ? `${totals.lateCount} (${formatMinutes(totals.lateMinutes)})`
              : "0",
          ],
          ["Faltas", String(totals.absences)],
          ["Sin salida", String(totals.missingClockOut)],
        ].map(([label, value]) => (
          <Card key={label} size="sm">
            <CardHeader>
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground uppercase">
            {WEEK_ORDER.map((weekday) => (
              <span key={weekday}>{WEEKDAY_SHORT[weekday]}</span>
            ))}
          </div>
          {monthGrid(month).map((week, index) => (
            <div key={index} className="grid grid-cols-7 gap-1">
              {week.map((dateKey, cell) => {
                if (!dateKey) return <span key={cell} />;
                const day = byDate.get(dateKey)!;
                const first = day.records[0];
                const last = day.records.at(-1);
                const content = (
                  <>
                    <span className="flex items-center justify-between gap-1">
                      <span className="text-sm font-semibold tabular-nums">
                        {Number(dateKey.slice(8))}
                      </span>
                      <MarkFlags
                        corrected={day.corrected}
                        offline={day.offline}
                        suspicious={day.suspicious}
                      />
                    </span>
                    {first ? (
                      <span className="text-[0.7rem] leading-tight tabular-nums">
                        {timeFormat.format(first.clockInAt)}
                        <br />
                        {last?.clockOutAt ? timeFormat.format(last.clockOutAt) : "sin salida"}
                      </span>
                    ) : (
                      <span className="text-[0.7rem] leading-tight">
                        {DAY_STATUS_LABELS[day.status]}
                      </span>
                    )}
                  </>
                );
                const className = cn(
                  "flex min-h-20 flex-col justify-between rounded-md p-1.5 text-left",
                  DAY_STATUS_CELLS[day.status],
                );
                if (day.status === "none") {
                  return (
                    <span key={dateKey} className={className}>
                      {content}
                    </span>
                  );
                }
                return first ? (
                  <Link
                    key={dateKey}
                    href={`/admin/asistencia/jornada/${first.id}`}
                    className={cn(className, "transition hover:ring-2 hover:ring-primary")}
                    title={`${DAY_STATUS_LABELS[day.status]}${day.lateMinutes ? ` · ${day.lateMinutes} min tarde` : ""}`}
                  >
                    {content}
                  </Link>
                ) : (
                  <Link
                    key={dateKey}
                    href={`/admin/asistencia?vista=dia&fecha=${dateKey}`}
                    className={className}
                    title={DAY_STATUS_LABELS[day.status]}
                  >
                    {content}
                  </Link>
                );
              })}
            </div>
          ))}
        </CardContent>
      </Card>
      <StatusLegend />
    </div>
  );
}
