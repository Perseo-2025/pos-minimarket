import { cookies } from "next/headers";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { AppFooter } from "@/components/layout/app-footer";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { requirePagePermission } from "@/infrastructure/auth/guards";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requirePagePermission("manage");

  // Persisted by SidebarProvider itself, so the collapsed state survives
  // navigation and reloads without a flash.
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={defaultOpen}>
        <AdminSidebar userName={user.name ?? "Administrador"} />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <span className="text-sm text-muted-foreground">
              Panel de administración
            </span>
          </header>
          <div className="flex-1 p-4 md:p-6">{children}</div>
          <AppFooter />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
