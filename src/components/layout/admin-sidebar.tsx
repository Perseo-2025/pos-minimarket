"use client";

import {
  CalendarClockIcon,
  ClipboardListIcon,
  IdCardIcon,
  LayoutDashboardIcon,
  PackageIcon,
  ReceiptTextIcon,
  ShieldCheckIcon,
  StoreIcon,
  TagsIcon,
  TruckIcon,
  UsersIcon,
  WalletIcon,
  WarehouseIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { initials } from "@/lib/initials";
import { AREAS } from "./area-links";
import { LogoutButton } from "./logout-button";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/admin/sales", label: "Ventas", icon: ReceiptTextIcon },
  { href: "/admin/caja", label: "Cierres de caja", icon: WalletIcon },
  { href: "/admin/asistencia", label: "Asistencia", icon: CalendarClockIcon },
  { href: "/admin/categories", label: "Categorías", icon: TagsIcon },
  { href: "/admin/products", label: "Productos", icon: PackageIcon },
  { href: "/admin/compras", label: "Compras", icon: ClipboardListIcon },
  { href: "/admin/inventory", label: "Inventario", icon: WarehouseIcon },
  { href: "/admin/suppliers", label: "Proveedores", icon: TruckIcon },
  { href: "/admin/users", label: "Usuarios", icon: UsersIcon },
  {
    href: "/admin/workers",
    label: "Trabajadores aeropuerto",
    icon: IdCardIcon,
  },
  { href: "/admin/audit", label: "Auditoría", icon: ShieldCheckIcon },
];

export function AdminSidebar({ userName }: { userName: string }) {
  const pathname = usePathname();

  // "/admin" must match exactly, otherwise it would stay highlighted on
  // every nested admin route.
  const isActive = (href: string) =>
    href === "/admin" ? pathname === href : pathname.startsWith(href);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href="/admin" />}
              tooltip="NAVEXPRESS"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <StoreIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate font-heading font-semibold">
                  NAVEXPRESS
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  Administración
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator className="mx-0" />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Gestión</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {NAV_ITEMS.map((item) => {
                const active = isActive(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={item.label}
                      render={<Link href={item.href} />}
                      className="relative h-9 transition-[width,height,padding,background-color,color] duration-150 before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-sidebar-primary before:opacity-0 before:transition-opacity data-active:text-sidebar-primary data-active:before:opacity-100 group-data-[collapsible=icon]:before:hidden [&>svg]:transition-transform hover:[&>svg]:translate-x-0.5"
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Ir a</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {AREAS.filter((area) => area.permission !== "manage").map(
                (area) => (
                  <SidebarMenuItem key={area.href}>
                    <SidebarMenuButton
                      tooltip={area.label}
                      render={<Link href={area.href} />}
                      className="h-9"
                    >
                      <area.icon />
                      <span>{area.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ),
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarSeparator className="mx-0" />
        <div className="flex items-center gap-2 px-1 py-1 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:px-0">
          <Avatar size="sm">
            <AvatarFallback>{initials(userName)}</AvatarFallback>
          </Avatar>
          <div className="grid flex-1 leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-medium">{userName}</span>
            <span className="truncate text-xs text-muted-foreground">
              Administrador
            </span>
          </div>
          <LogoutButton />
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
