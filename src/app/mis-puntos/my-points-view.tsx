"use client";

import { AlertTriangleIcon, LogOutIcon, SparklesIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { getMyPoints } from "@/actions/workers";
import { BirthDateInput } from "@/components/birth-date-input";
import type { WorkerStatement } from "@/application/use-cases/workers/get-worker-statement";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WORKER_STATUS_LABELS } from "@/domain/entities/worker";
import { formatSoles } from "@/lib/money";

const dateTimeFormat = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Lima",
});

export function MyPointsView() {
  const [isPending, startTransition] = useTransition();
  const [dni, setDni] = useState("");
  const [birthDate, setBirthDate] = useState<string | null>(null);
  // Remounts the date field to clear it after each attempt.
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [statement, setStatement] = useState<WorkerStatement | null>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await getMyPoints({ dni, birthDate });
      setBirthDate(null);
      setAttempt((n) => n + 1);
      if (result.ok) setStatement(result.data);
      else setError(result.error);
    });
  }

  if (statement) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardDescription>Trabajador del aeropuerto</CardDescription>
          <CardTitle className="text-xl font-heading">{statement.fullName}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {statement.company} · {WORKER_STATUS_LABELS[statement.status]}
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex items-center gap-3 rounded-xl bg-brand-orange/10 p-4">
            <SparklesIcon className="size-8 text-brand-orange" aria-hidden />
            <div>
              <p className="text-sm text-muted-foreground">Tus puntos</p>
              <p className="text-3xl font-bold tabular-nums">{statement.pointsBalance}</p>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-semibold">Tus últimas compras</h2>
            {statement.purchases.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aún no tienes compras.</p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {statement.purchases.map((purchase) => (
                  <li key={purchase.saleId} className="flex justify-between gap-3 p-3 text-sm">
                    <div>
                      <p>
                        <span className="font-mono font-medium">Orden #{purchase.saleId}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          · {dateTimeFormat.format(new Date(purchase.clientCreatedAt))}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {purchase.discountTotal > 0
                          ? `Ahorraste ${formatSoles(purchase.discountTotal)}`
                          : "Sin descuento"}
                        {purchase.giftTotal > 0 && " · regalo de cumpleaños 🎂"} · +
                        {purchase.pointsEarned} pts
                      </p>
                    </div>
                    <span className="font-semibold tabular-nums">
                      {formatSoles(purchase.total)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
            <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
            <p>
              ¿Ves una compra que <strong>no hiciste</strong>? Avisa al encargado de
              la tienda: alguien podría estar usando tu DNI.
            </p>
          </div>

          <Button variant="outline" onClick={() => setStatement(null)}>
            <LogOutIcon data-icon="inline-start" />
            Salir
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-2xl font-heading">Mis puntos</CardTitle>
        <CardDescription>
          Para trabajadores del aeropuerto. Ingresa tu DNI y tu fecha de
          nacimiento.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="dni">DNI</Label>
            <Input
              id="dni"
              inputMode="numeric"
              autoComplete="off"
              maxLength={8}
              value={dni}
              onChange={(e) => setDni(e.target.value.replace(/\D/g, "").slice(0, 8))}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="birth-date">Fecha de nacimiento</Label>
            <BirthDateInput key={attempt} id="birth-date" onChange={setBirthDate} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={isPending || dni.length !== 8 || birthDate === null}>
            {isPending ? "Consultando…" : "Ver mis puntos"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
