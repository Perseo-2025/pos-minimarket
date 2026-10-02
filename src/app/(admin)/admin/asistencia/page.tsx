import { Suspense } from "react";
import { idSchema } from "@/application/validation/id";
import {
  AttendanceNav,
  type AttendanceView,
} from "@/components/admin/attendance/attendance-nav";
import {
  CorrectionsView,
  DayView,
  MonthView,
  RangeView,
  TodayView,
} from "@/components/admin/attendance/attendance-views";
import { PageHeader } from "@/components/admin/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { storeDateKey } from "@/domain/value-objects/store-time";
import { attendanceRepository } from "@/infrastructure/repositories";
import { parseDateRange } from "@/lib/date-range";

const VIEWS: AttendanceView[] = ["hoy", "dia", "mes", "rango", "correcciones"];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_PATTERN = /^\d{4}-\d{2}$/;

// The admin sees every mark of every person: today, any day, any month (with
// a calendar per person), any range (with CSV), and every correction.
export default async function AttendancePage({ searchParams }: PageProps<"/admin/asistencia">) {
  const params = await searchParams;
  const today = storeDateKey(new Date());
  const currentMonth = today.slice(0, 7);
  const view = VIEWS.includes(params.vista as AttendanceView)
    ? (params.vista as AttendanceView)
    : "hoy";

  const date =
    typeof params.fecha === "string" && DATE_PATTERN.test(params.fecha) && params.fecha <= today
      ? params.fecha
      : today;
  const month =
    typeof params.mes === "string" && MONTH_PATTERN.test(params.mes) && params.mes <= currentMonth
      ? params.mes
      : currentMonth;
  const range = parseDateRange(params, today);
  const person = idSchema.safeParse(params.persona);
  const pending = await attendanceRepository.countPendingCorrections();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Asistencia del personal"
        description="Entradas y salidas de cajeros y almaceneros. Las marcas no se pueden borrar: cada corrección queda registrada."
      />
      <AttendanceNav current={view} pendingCorrections={pending} />
      <Suspense
        key={`${view}-${date}-${month}-${range.from}-${range.to}-${params.persona ?? ""}`}
        fallback={<Skeleton className="h-96 rounded-xl" />}
      >
        {view === "hoy" && <TodayView today={today} pending={pending} />}
        {view === "dia" && <DayView date={date} today={today} />}
        {view === "mes" && <MonthView month={month} currentMonth={currentMonth} />}
        {view === "rango" && (
          <RangeView
            from={range.from}
            to={range.to}
            today={today}
            personId={person.success ? person.data : undefined}
          />
        )}
        {view === "correcciones" && <CorrectionsView />}
      </Suspense>
    </div>
  );
}
