"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { setUserActive } from "@/actions/users";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type User = {
  id: string;
  name: string;
  username: string;
  role: string;
  isActive: boolean;
};

export function UserTable({ users }: { users: User[] }) {
  const [isPending, startTransition] = useTransition();

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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nombre</TableHead>
          <TableHead>Usuario</TableHead>
          <TableHead>Rol</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell>{user.name}</TableCell>
            <TableCell>{user.username}</TableCell>
            <TableCell>{user.role === "admin" ? "Admin" : "Cajero"}</TableCell>
            <TableCell>
              <Badge variant={user.isActive ? "default" : "secondary"}>
                {user.isActive ? "Activo" : "Inactivo"}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <Button
                size="sm"
                variant={user.isActive ? "destructive" : "outline"}
                disabled={isPending}
                onClick={() => handleToggle(user)}
              >
                {user.isActive ? "Desactivar" : "Activar"}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
