import { Badge } from "@/components/ui/badge";
import { WORKER_STATUS_LABELS, type WorkerStatus } from "@/domain/entities/worker";
import { cn } from "@/lib/utils";

const STYLES: Record<WorkerStatus, { badge: string; dot: string }> = {
  pending: {
    badge: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  active: {
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  suspended: {
    badge: "border-destructive/30 bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
  rejected: { badge: "text-muted-foreground", dot: "bg-muted-foreground/50" },
};

export function WorkerStatusBadge({ status }: { status: WorkerStatus }) {
  return (
    <Badge variant="outline" className={cn(STYLES[status].badge)}>
      <span aria-hidden className={cn("size-1.5 rounded-full", STYLES[status].dot)} />
      {WORKER_STATUS_LABELS[status]}
    </Badge>
  );
}
