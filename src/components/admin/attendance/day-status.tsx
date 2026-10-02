import { CloudOffIcon, PencilLineIcon, TriangleAlertIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DAY_STATUS_LABELS, type DayStatus } from "@/domain/services/attendance";
import { cn } from "@/lib/utils";

export const DAY_STATUS_TONES: Record<DayStatus, string> = {
  on_time: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  late: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  absent: "border-destructive/30 bg-destructive/10 text-destructive",
  no_clock_out: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-400",
  working: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  day_off: "text-muted-foreground",
  extra: "border-sky-500/30 text-sky-700 dark:text-sky-400",
  pending: "text-muted-foreground",
  none: "text-muted-foreground",
};

// Solid colors for the month calendar cells.
export const DAY_STATUS_CELLS: Record<DayStatus, string> = {
  on_time: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
  late: "bg-amber-500/20 text-amber-800 dark:text-amber-300",
  absent: "bg-destructive/15 text-destructive",
  no_clock_out: "bg-violet-500/15 text-violet-800 dark:text-violet-300",
  working: "bg-sky-500/15 text-sky-800 dark:text-sky-300",
  day_off: "bg-muted/40 text-muted-foreground",
  extra: "bg-sky-500/10 text-sky-800 dark:text-sky-300",
  pending: "bg-muted/40 text-muted-foreground",
  none: "text-muted-foreground/50",
};

export function DayStatusBadge({ status }: { status: DayStatus }) {
  if (status === "none") return null;
  return (
    <Badge variant="outline" className={cn(DAY_STATUS_TONES[status])}>
      {DAY_STATUS_LABELS[status]}
    </Badge>
  );
}

// Why a workday deserves a second look, with the reason on hover.
export function MarkFlags({
  corrected,
  offline,
  suspicious,
}: {
  corrected: boolean;
  offline: boolean;
  suspicious: boolean;
}) {
  if (!corrected && !offline && !suspicious) return null;
  return (
    <span className="inline-flex items-center gap-1.5">
      {suspicious && (
        <span title="Hora dudosa: el reloj del equipo estaba mal o fue atrasado">
          <TriangleAlertIcon className="size-4 text-destructive" aria-label="Hora dudosa" />
        </span>
      )}
      {corrected && (
        <span title="Corregido por el administrador">
          <PencilLineIcon className="size-4 text-amber-600 dark:text-amber-400" aria-label="Corregido" />
        </span>
      )}
      {offline && (
        <span title="Marcado sin internet (hora del equipo)">
          <CloudOffIcon className="size-4 text-muted-foreground" aria-label="Sin internet" />
        </span>
      )}
    </span>
  );
}

export function StatusLegend() {
  const shown: DayStatus[] = ["on_time", "late", "absent", "no_clock_out", "working", "extra", "day_off"];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
      {shown.map((status) => (
        <span key={status} className="flex items-center gap-1.5">
          <span className={cn("size-3 rounded-sm", DAY_STATUS_CELLS[status])} />
          {DAY_STATUS_LABELS[status]}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <TriangleAlertIcon className="size-3.5 text-destructive" /> Hora dudosa
      </span>
      <span className="flex items-center gap-1.5">
        <PencilLineIcon className="size-3.5 text-amber-600" /> Corregido
      </span>
      <span className="flex items-center gap-1.5">
        <CloudOffIcon className="size-3.5" /> Sin internet
      </span>
    </div>
  );
}
