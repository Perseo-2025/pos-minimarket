"use client";

import { GiftIcon, ShieldCheckIcon, WifiOffIcon } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lineTotal } from "@/domain/services/sale-pricing";
import { round2 } from "@/domain/value-objects/money";
import { useIsOnline } from "@/hooks/use-online-status";
import { formatSoles } from "@/lib/money";

export type CourtesyLine = {
  productId: number;
  productName: string;
  unitPrice: number;
  quantity: number;
};

export type CourtesyApproval = {
  token: string;
  amount: number;
  adminName: string;
};

// An admin approves, at the cashier's till, giving these products away. The
// admin types their own username and password; the cashier never learns them
// (the fields are cleared as soon as the dialog closes).
export function CourtesyDialog({
  open,
  onOpenChange,
  saleUuid,
  lines,
  onApproved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // The approval is signed for this sale (it has no numeric id before sync).
  saleUuid: string;
  // Every line that will be free once approved (not only the new one).
  lines: CourtesyLine[];
  onApproved: (approval: CourtesyApproval) => void;
}) {
  const isOnline = useIsOnline();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const amount = round2(lines.reduce((sum, line) => sum + lineTotal(line), 0));

  function handleOpenChange(next: boolean) {
    if (pending) return;
    if (!next) {
      setUsername("");
      setPassword("");
      setError(null);
    }
    onOpenChange(next);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/courtesy/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, saleUuid, items: lines }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setPassword("");
        setError(body?.error ?? "No se pudo aprobar la cortesía");
        return;
      }
      onApproved({ token: body.token, amount: body.amount, adminName: body.adminName });
      setUsername("");
      setPassword("");
      onOpenChange(false);
    } catch {
      setError("Sin conexión con el servidor. Inténtalo de nuevo.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <GiftIcon className="size-5 text-brand-orange" aria-hidden />
            Aprobar cortesía
          </DialogTitle>
          <DialogDescription>
            Estos productos se entregarán gratis. Un administrador debe aprobarlo
            con su usuario y contraseña.
          </DialogDescription>
        </DialogHeader>

        <ul className="divide-y rounded-lg border">
          {lines.map((line) => (
            <li
              key={line.productId}
              className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate">
                {line.quantity} × {line.productName}
              </span>
              <span className="font-medium tabular-nums">
                {formatSoles(lineTotal(line))}
              </span>
            </li>
          ))}
          <li className="flex items-center justify-between gap-3 bg-muted/40 px-3 py-2 text-sm font-semibold">
            <span>Valor regalado</span>
            <span className="tabular-nums">{formatSoles(amount)}</span>
          </li>
        </ul>

        {!isOnline ? (
          <Alert variant="destructive">
            <WifiOffIcon />
            <AlertTitle>Se necesita internet</AlertTitle>
            <AlertDescription>
              La cortesía se aprueba con la contraseña del administrador y se
              valida en el servidor. Sin conexión no se puede regalar un
              producto: cóbralo o espera a que vuelva internet.
            </AlertDescription>
          </Alert>
        ) : (
          <form id="courtesy-form" onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="courtesy-admin-user">Usuario del administrador</Label>
              <Input
                id="courtesy-admin-user"
                autoComplete="off"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="courtesy-admin-password">Contraseña</Label>
              <Input
                id="courtesy-admin-password"
                type="password"
                // Never let the browser offer to save the admin's password
                // on the cashier's tablet.
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <ShieldCheckIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Cada aprobación y cada contraseña incorrecta quedan registradas en
              la auditoría.
            </p>
          </form>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            className="h-11"
            disabled={pending}
            onClick={() => handleOpenChange(false)}
          >
            Cancelar
          </Button>
          {isOnline && (
            <Button
              type="submit"
              form="courtesy-form"
              className="h-11 font-semibold"
              disabled={pending}
            >
              {pending ? "Verificando..." : "Aprobar cortesía"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
