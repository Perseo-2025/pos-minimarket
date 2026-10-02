"use client";

import { ClockIcon, LogOutIcon, WalletIcon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { requiresAttendance } from "@/domain/entities/attendance";
import { getLocalShift } from "@/infrastructure/offline/shift-ops";
import { useAttendanceContext } from "./attendance-provider";
import { formatTime } from "./time-format";

// "Entrada 07:04" in the header, and "Marcar salida" at the end of the day.
// With the till still open on this device, the exit waits: first "Cerrar
// caja", so nobody leaves without counting the drawer.
export function AttendanceBadge() {
  const { state, role, userId, clockOut } = useAttendanceContext();
  const [open, setOpen] = useState(false);
  const [tillOpen, setTillOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [isPending, startTransition] = useTransition();

  if (!requiresAttendance(role) || !state?.current) return null;
  const clockInAt = state.current.clockInAt;

  async function handleOpen() {
    setTillOpen(Boolean(await getLocalShift(userId)));
    setNow(new Date());
    setOpen(true);
  }

  function handleClockOut() {
    startTransition(async () => {
      try {
        await clockOut();
        setOpen(false);
        toast.success(`Salida registrada ${formatTime(new Date())}`, {
          description: "¡Gracias por tu jornada!",
        });
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => void handleOpen()}>
        <ClockIcon data-icon="inline-start" />
        <span className="hidden sm:inline">Entrada</span> {formatTime(clockInAt)}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          {tillOpen ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Primero cierra tu caja</AlertDialogTitle>
                <AlertDialogDescription>
                  Tu caja sigue abierta. Cuenta el dinero y ciérrala antes de marcar tu salida.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Entendido</AlertDialogCancel>
                <Button nativeButton={false} render={<Link href="/pos" />} onClick={() => setOpen(false)}>
                  <WalletIcon data-icon="inline-start" />
                  Ir a la caja
                </Button>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Terminas tu jornada?</AlertDialogTitle>
                <AlertDialogDescription>
                  Entraste a las {formatTime(clockInAt)}. Tu salida quedará a las{" "}
                  {formatTime(now)}.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
                <Button disabled={isPending} onClick={handleClockOut}>
                  <LogOutIcon data-icon="inline-start" />
                  {isPending ? "Marcando..." : "Marcar salida"}
                </Button>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
