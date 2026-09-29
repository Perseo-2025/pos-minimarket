"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { setUserActive } from "@/actions/users";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { usePagination } from "@/hooks/use-pagination";
import { initials } from "@/lib/initials";
import { DataTable } from "./data-table";
import { DataTablePagination } from "./data-table-pagination";
import { StatusBadge } from "./status-badge";

type User = {
  id: string;
  name: string;
  username: string;
  role: string;
  isActive: boolean;
};

const COLUMNS = [
  { label: "Usuario" },
  { label: "Rol" },
  { label: "Estado" },
  { label: "Acciones", className: "text-right" },
];

export function UserTable({ users }: { users: User[] }) {
  const [isPending, startTransition] = useTransition();
  const pagination = usePagination(users);

  function handleToggle(user: User) {
    startTransition(async () => {
      try {
        await setUserActive(user.id, !user.isActive);
        toast.success(user.isActive ? "Usuario desactivado" : "Usuario activado");
      } catch {
        toast.error("No se pudo actualizar el usuario");
      }
    });
  }

  return (
    <DataTable
      columns={COLUMNS}
      isEmpty={users.length === 0}
      emptyMessage="Aún no hay usuarios registrados."
      footer={
        <DataTablePagination
          {...pagination}
          onPageChange={pagination.setPage}
          itemLabel="usuarios"
        />
      }
    >
      {pagination.rows.map((user) => (
        <TableRow key={user.id}>
          <TableCell>
            <div className="flex items-center gap-3">
              <Avatar size="sm">
                <AvatarFallback>{initials(user.name)}</AvatarFallback>
              </Avatar>
              <div className="leading-tight">
                <div className="font-medium">{user.name}</div>
                <div className="text-xs text-muted-foreground">
                  @{user.username}
                </div>
              </div>
            </div>
          </TableCell>
          <TableCell>
            <Badge variant={user.role === "admin" ? "secondary" : "outline"}>
              {user.role === "admin" ? "Administrador" : "Cajero"}
            </Badge>
          </TableCell>
          <TableCell>
            <StatusBadge active={user.isActive} />
          </TableCell>
          <TableCell className="text-right">
            <Button
              size="sm"
              variant={user.isActive ? "ghost" : "outline"}
              className={
                user.isActive
                  ? "text-destructive hover:bg-destructive/10 hover:text-destructive"
                  : undefined
              }
              disabled={isPending}
              onClick={() => handleToggle(user)}
            >
              {user.isActive ? "Desactivar" : "Activar"}
            </Button>
          </TableCell>
        </TableRow>
      ))}
    </DataTable>
  );
}
