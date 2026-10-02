import Link from "next/link";
import { cn } from "@/lib/utils";

export type AttendanceView = "hoy" | "dia" | "mes" | "rango" | "correcciones";

const VIEWS: { view: AttendanceView; label: string }[] = [
  { view: "hoy", label: "Hoy" },
  { view: "dia", label: "Por día" },
  { view: "mes", label: "Por mes" },
  { view: "rango", label: "Reporte de horas" },
  { view: "correcciones", label: "Correcciones" },
];

export function AttendanceNav({
  current,
  pendingCorrections,
}: {
  current: AttendanceView | "horarios";
  pendingCorrections: number;
}) {
  const tab = (active: boolean) =>
    cn(
      "inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors",
      active ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
    );
  return (
    <nav
      aria-label="Vistas de asistencia"
      className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1"
    >
      {VIEWS.map(({ view, label }) => (
        <Link
          key={view}
          href={`/admin/asistencia?vista=${view}`}
          className={tab(current === view)}
          aria-current={current === view ? "page" : undefined}
        >
          {label}
          {view === "correcciones" && pendingCorrections > 0 && (
            <span className="rounded-full bg-amber-500 px-1.5 text-xs text-white tabular-nums">
              {pendingCorrections}
            </span>
          )}
        </Link>
      ))}
      <Link
        href="/admin/asistencia/horarios"
        className={tab(current === "horarios")}
        aria-current={current === "horarios" ? "page" : undefined}
      >
        Horarios
      </Link>
    </nav>
  );
}
