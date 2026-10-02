import { attendanceReportUseCase } from "@/application/use-cases/attendance/reports";
import { idSchema } from "@/application/validation/id";
import { USER_ROLE_LABELS } from "@/domain/entities/user";
import { DAY_STATUS_LABELS, WEEKDAY_LABELS, weekdayOf } from "@/domain/services/attendance";
import { storeDateKey, STORE_TIME_ZONE } from "@/domain/value-objects/store-time";
import { userWithPermission } from "@/infrastructure/auth/guards";
import { attendanceDeps } from "@/infrastructure/deps";
import { parseDateRange } from "@/lib/date-range";

// Up to a year at once: enough for any payroll, bounded for the server.
const MAX_DAYS = 366;

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: STORE_TIME_ZONE,
});
const time = (value: Date | null | undefined) => (value ? timeFormat.format(value) : "");

// Semicolon-separated with a BOM: opens directly in Excel set to Spanish.
function csvCell(value: string | number) {
  const text = String(value);
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// Day-by-day attendance of the range (one person or everyone), for payroll.
export async function GET(request: Request) {
  const admin = await userWithPermission("manage");
  if (!admin) return new Response("No autorizado", { status: 401 });

  const url = new URL(request.url);
  const today = storeDateKey(new Date());
  const { from, to } = parseDateRange(Object.fromEntries(url.searchParams), today);
  const days = (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000 + 1;
  if (days > MAX_DAYS) return new Response("Rango demasiado largo (máximo un año)", { status: 400 });
  const person = idSchema.safeParse(url.searchParams.get("persona"));

  const reports = await attendanceReportUseCase(attendanceDeps, {
    from,
    to,
    userId: person.success ? person.data : undefined,
  });

  const header = [
    "Persona",
    "Rol",
    "Fecha",
    "Día",
    "Estado",
    "Horario entrada",
    "Horario salida",
    "Entrada",
    "Salida",
    "Horas trabajadas",
    "Minutos trabajados",
    "Tardanza (min)",
    "Salió antes (min)",
    "Corregido",
    "Sin internet",
    "Hora dudosa",
  ];
  const lines = [header.map(csvCell).join(";")];
  for (const { person: p, days: personDays } of reports) {
    for (const day of personDays) {
      if (day.status === "none") continue;
      const first = day.records[0];
      const last = day.records.at(-1);
      lines.push(
        [
          p.name,
          USER_ROLE_LABELS[p.role],
          day.dateKey,
          WEEKDAY_LABELS[weekdayOf(day.dateKey)],
          DAY_STATUS_LABELS[day.status],
          time(day.shift?.start),
          time(day.shift?.end),
          time(first?.clockInAt),
          time(last?.clockOutAt),
          (day.workedMinutes / 60).toFixed(2).replace(".", ","),
          day.workedMinutes,
          day.lateMinutes,
          day.earlyLeaveMinutes,
          day.corrected ? "Sí" : "",
          day.offline ? "Sí" : "",
          day.suspicious ? "Sí" : "",
        ]
          .map(csvCell)
          .join(";"),
      );
    }
  }

  const name = person.success ? `asistencia-${person.data}-${from}_${to}` : `asistencia-${from}_${to}`;
  return new Response(`﻿${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
