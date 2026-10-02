"use client";

import { LockOpenIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// "Abrir caja": before the first sale of the shift, the cashier writes how
// much money is in the drawer. Works without internet.
export function OpenShiftPanel({
  onOpen,
}: {
  onOpen: (openingCash: number) => Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const value = Number(amount);
    if (amount === "" || !Number.isFinite(value) || value < 0) {
      setError("Escribe con cuánto dinero empiezas (puede ser 0)");
      return;
    }
    setError(null);
    startTransition(() => onOpen(Math.round(value * 100) / 100));
  }

  return (
    <div className="flex h-[calc(100vh-57px)] items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <LockOpenIcon className="size-7" aria-hidden />
          </span>
          <CardTitle className="text-xl">Abrir caja</CardTitle>
          <CardDescription>
            Cuenta el dinero que hay en el cajón antes de empezar a vender.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="opening-cash">¿Con cuánto dinero empiezas? (S/)</Label>
              <Input
                id="opening-cash"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.10"
                placeholder="100.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-12 text-center text-2xl font-semibold"
                autoFocus
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" disabled={isPending}>
              {isPending ? "Abriendo..." : "Abrir caja y empezar a vender"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
