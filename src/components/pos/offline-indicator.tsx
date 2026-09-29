"use client";

import { Badge } from "@/components/ui/badge";
import { useOnlineStatus } from "@/hooks/use-online-status";

export function OfflineIndicator() {
  const { isOnline, pendingCount } = useOnlineStatus();

  if (isOnline && pendingCount === 0) {
    return <Badge variant="secondary">En línea</Badge>;
  }

  return (
    <Badge variant={isOnline ? "secondary" : "destructive"}>
      {isOnline ? "Sincronizando" : "Sin conexión"}
      {pendingCount > 0 ? ` · ${pendingCount} pendiente(s)` : ""}
    </Badge>
  );
}
