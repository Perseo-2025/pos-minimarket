import { UserRoundIcon, WarehouseIcon } from "lucide-react";
import Link from "next/link";
import { AttendanceBadge } from "@/components/attendance/attendance-badge";
import { AttendanceGate } from "@/components/attendance/attendance-gate";
import { AttendanceProvider } from "@/components/attendance/attendance-provider";
import { initialAttendance } from "@/components/attendance/initial-state";
import { AppFooter } from "@/components/layout/app-footer";
import { AreaLinks } from "@/components/layout/area-links";
import { LogoutButton } from "@/components/layout/logout-button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { requirePagePermission } from "@/infrastructure/auth/guards";

// The warehouse keeper's area, built for a phone in the back room. The admin
// can enter too (they have every permission).
export default async function WarehouseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requirePagePermission("stock");
  const attendance = await initialAttendance(user);

  return (
    <TooltipProvider>
      <AttendanceProvider
        userId={user.id}
        name={user.name ?? ""}
        role={user.role}
        initial={attendance}
      >
        <div className="flex min-h-screen flex-col">
          <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
            <Link href="/almacen" className="flex items-center gap-2 font-heading font-semibold">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <WarehouseIcon className="size-4" aria-hidden />
              </span>
              Almacén
            </Link>
            <div className="flex items-center gap-2">
              <AreaLinks role={user.role} current="stock" />
              <AttendanceBadge />
              <span className="hidden items-center gap-1.5 text-sm text-muted-foreground sm:flex">
                <UserRoundIcon className="size-4" aria-hidden />
                {user.name}
              </span>
              <LogoutButton />
            </div>
          </header>
          {/* The warehouse keeper works only after "Marcar entrada". */}
          <main className="mx-auto w-full max-w-3xl flex-1 p-4">
            <AttendanceGate>{children}</AttendanceGate>
          </main>
          <AppFooter />
        </div>
      </AttendanceProvider>
    </TooltipProvider>
  );
}
