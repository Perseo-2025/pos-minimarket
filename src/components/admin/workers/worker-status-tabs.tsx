import Link from "next/link";
import type { WorkerStatus } from "@/domain/entities/worker";
import { cn } from "@/lib/utils";

const TABS: { status: WorkerStatus; label: string }[] = [
  { status: "pending", label: "Por aprobar" },
  { status: "active", label: "Activos" },
  { status: "suspended", label: "Suspendidos" },
  { status: "rejected", label: "Rechazados" },
];

// Lives in the URL (?status=…) so the sidebar/audit links can deep-link.
export function WorkerStatusTabs({
  current,
  counts,
}: {
  current: WorkerStatus;
  counts: Record<WorkerStatus, number>;
}) {
  return (
    <nav
      aria-label="Filtrar trabajadores por estado"
      className="flex gap-1 overflow-x-auto rounded-xl border bg-muted/40 p-1"
    >
      {TABS.map((tab) => {
        const active = tab.status === current;
        const count = counts[tab.status];
        return (
          <Link
            key={tab.status}
            href={`/admin/workers?status=${tab.status}`}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
              active
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            <span
              className={cn(
                "rounded-full px-1.5 text-xs tabular-nums",
                tab.status === "pending" && count > 0
                  ? "bg-amber-500 text-white"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {count}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
