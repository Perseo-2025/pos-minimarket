import {
  LayoutDashboardIcon,
  type LucideIcon,
  ShoppingCartIcon,
  WarehouseIcon,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { can, type Permission, type UserRole } from "@/domain/entities/user";

export const AREAS: {
  permission: Permission;
  href: string;
  label: string;
  icon: LucideIcon;
}[] = [
  { permission: "manage", href: "/admin", label: "Panel", icon: LayoutDashboardIcon },
  { permission: "sell", href: "/pos", label: "Caja", icon: ShoppingCartIcon },
  { permission: "stock", href: "/almacen", label: "Almacén", icon: WarehouseIcon },
];

// Jump to the other areas this role may enter (the admin sees all of them;
// a cashier or warehouse keeper sees none).
export function AreaLinks({
  role,
  current,
}: {
  role: UserRole;
  current: Permission;
}) {
  const others = AREAS.filter(
    (area) => area.permission !== current && can(role, area.permission),
  );
  if (others.length === 0) return null;
  return (
    <nav aria-label="Ir a otra área" className="flex items-center gap-2">
      {others.map(({ href, label, icon: Icon }) => (
        <Button
          key={href}
          size="sm"
          variant="outline"
          nativeButton={false}
          render={<Link href={href} />}
        >
          <Icon data-icon="inline-start" />
          <span className="hidden sm:inline">{label}</span>
        </Button>
      ))}
    </nav>
  );
}
