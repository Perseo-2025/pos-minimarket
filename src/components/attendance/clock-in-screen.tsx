"use client";

import {
  CircleCheckIcon,
  ClockIcon,
  HistoryIcon,
  MinusIcon,
  PlusIcon,
  WifiOffIcon,
} from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { LogoutButton } from "@/components/layout/logout-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { computeLateMinutes, scheduleFor } from "@/domain/services/attendance";
import { STORE_UTC_OFFSET, storeDateKey } from "@/domain/value-objects/store-time";
import { useIsOnline } from "@/hooks/use-online-status";
import { cn } from "@/lib/utils";
import { useAttendanceContext } from "./attendance-provider";
import { formatTime, formatWorkDate, storeHhmm } from "./time-format";

function greeting(now: Date) {
  const hour = Number(storeHhmm(now).slice(0, 2));
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100dvh-57px-var(--app-footer-h))] items-center justify-center p-4">
      <Card className="w-full max-w-md">{children}</Card>
    </div>
  );
}

function Icon({ icon: IconComponent, tone = "primary" }: { icon: typeof ClockIcon; tone?: "primary" | "success" | "warning" }) {
  return (
    <span
      className={cn(
        "mx-auto flex size-14 items-center justify-center rounded-full",
        tone === "primary" && "bg-primary/10 text-primary",
        tone === "success" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
        tone === "warning" && "bg-amber-500/10 text-amber-700 dark:text-amber-400",
      )}
    >
      <IconComponent className="size-7" aria-hidden />
    </span>
  );
}

// "Entrada registrada 07:04 ✓", shown a moment before the normal screen.
export function ClockInDone({ clockInAt, onContinue }: { clockInAt: string; onContinue: () => void }) {
  const { state } = useAttendanceContext();
  const at = new Date(clockInAt);
  const late = computeLateMinutes(at, scheduleFor(storeDateKey(at), state?.schedules ?? []));

  useEffect(() => {
    const id = setTimeout(onContinue, 2500);
    return () => clearTimeout(id);
  }, [onContinue]);

  return (
    <Screen>
      <CardHeader className="text-center">
        <Icon icon={CircleCheckIcon} tone="success" />
        <CardTitle className="text-xl">Entrada registrada {formatTime(at)}</CardTitle>
        <CardDescription>
          {late > 0 ? (
            <span className="font-medium text-amber-700 dark:text-amber-400">
              Tardanza: {late} min. Quedó registrada.
            </span>
          ) : (
            "¡Que tengas un buen turno!"
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button size="lg" className="w-full" onClick={onContinue}>
          Continuar
        </Button>
      </CardContent>
    </Screen>
  );
}

// Before working: the big "MARCAR ENTRADA" button. First, if a previous
// workday was left open, the person says when they left (an admin approves).
export function ClockInScreen({ onClockedIn }: { onClockedIn: (clockInAt: string) => void }) {
  const { state, name, clockIn } = useAttendanceContext();
  const now = useNow();
  const isOnline = useIsOnline();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [again, setAgain] = useState(false);

  if (!state) return null;
  if (state.forgotten.length > 0) return <ForgottenExitStep />;

  const today = storeDateKey(now);
  const shift = scheduleFor(today, state.schedules);
  const late = computeLateMinutes(now, shift);
  const finishedToday =
    state.lastClosed && storeDateKey(new Date(state.lastClosed.clockOutAt)) === today;

  function handleClockIn() {
    setError(null);
    startTransition(async () => {
      try {
        const current = await clockIn();
        onClockedIn(current.clockInAt);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  if (finishedToday && !again) {
    return (
      <Screen>
        <CardHeader className="text-center">
          <Icon icon={CircleCheckIcon} tone="success" />
          <CardTitle className="text-xl">Tu jornada de hoy terminó</CardTitle>
          <CardDescription>
            Entraste a las {formatTime(state.lastClosed!.clockInAt)} y saliste a las{" "}
            {formatTime(state.lastClosed!.clockOutAt)}. ¡Gracias, {name}!
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button size="lg" variant="outline" onClick={() => setAgain(true)}>
            Volver a marcar entrada
          </Button>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            Cerrar sesión <LogoutButton />
          </div>
        </CardContent>
      </Screen>
    );
  }

  return (
    <Screen>
      <CardHeader className="text-center">
        <Icon icon={ClockIcon} />
        <CardTitle className="text-xl">
          {greeting(now)}, {name}
        </CardTitle>
        <CardDescription>
          {shift
            ? `Tu horario hoy: ${formatTime(shift.start)} – ${formatTime(shift.end)}`
            : "Hoy no tienes horario asignado."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="text-center">
          <div className="text-xs text-muted-foreground uppercase">Hora actual</div>
          <div className="font-heading text-5xl font-semibold tabular-nums">
            {formatTime(now)}
          </div>
        </div>

        {late > 0 && (
          <p className="rounded-md bg-amber-500/10 px-3 py-2 text-center text-sm text-amber-800 dark:text-amber-300">
            Llegas {late} min tarde. Quedará registrado.
          </p>
        )}
        {!isOnline && (
          <p className="flex items-center justify-center gap-2 rounded-md bg-muted px-3 py-2 text-center text-sm text-muted-foreground">
            <WifiOffIcon className="size-4 shrink-0" aria-hidden />
            Sin internet: tu marca se guarda en este equipo y se envía sola.
          </p>
        )}
        {error && (
          <p role="alert" className="text-center text-sm text-destructive">
            {error}
          </p>
        )}

        <Button size="lg" className="h-16 text-lg" disabled={isPending} onClick={handleClockIn}>
          {isPending ? "Marcando..." : "MARCAR ENTRADA"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Marca solo tú. La hora la pone el sistema y no se puede cambiar.
        </p>
      </CardContent>
    </Screen>
  );
}

const REASONS = [
  "Me olvidé de marcar la salida",
  "Se fue la luz o el internet",
  "El equipo no tenía batería",
];

const MINUTES_IN_DAY = 24 * 60;
const toHhmm = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

// Hour and minute with big +/− buttons: the system keyboard may be hidden
// while the barcode ring is connected.
function TimeStepper({ value, onChange }: { value: number; onChange: (minutes: number) => void }) {
  const step = (delta: number) => onChange((value + delta + MINUTES_IN_DAY) % MINUTES_IN_DAY);
  const [hh, mm] = toHhmm(value).split(":");
  return (
    <div className="flex items-center justify-center gap-4">
      {[
        { label: "Hora", text: hh, delta: 60 },
        { label: "Minutos", text: mm, delta: 5 },
      ].map(({ label, text, delta }) => (
        <div key={label} className="flex flex-col items-center gap-1">
          <Button size="icon-lg" variant="outline" aria-label={`Subir ${label}`} onClick={() => step(delta)}>
            <PlusIcon />
          </Button>
          <span className="font-heading text-4xl font-semibold tabular-nums" aria-label={label}>
            {text}
          </span>
          <Button size="icon-lg" variant="outline" aria-label={`Bajar ${label}`} onClick={() => step(-delta)}>
            <MinusIcon />
          </Button>
        </div>
      ))}
    </div>
  );
}

function ForgottenExitStep() {
  const { state, requestCorrection, skipCorrection } = useAttendanceContext();
  const forgotten = state!.forgotten[0];
  const clockInAt = new Date(forgotten.clockInAt);
  const shift = scheduleFor(forgotten.workDate, state!.schedules);
  // Suggested: the end of that day's shift, or 8 hours after entering.
  const suggested = shift?.end ?? new Date(clockInAt.getTime() + 8 * 60 * 60 * 1000);
  const [minutes, setMinutes] = useState(() => {
    const [h, m] = storeHhmm(suggested).split(":").map(Number);
    return h * 60 + m;
  });
  const [reason, setReason] = useState(REASONS[0]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function exitDate() {
    let exit = new Date(`${forgotten.workDate}T${toHhmm(minutes)}:00.000${STORE_UTC_OFFSET}`);
    // Earlier than the entrance: it was after midnight.
    if (exit <= clockInAt) exit = new Date(exit.getTime() + MINUTES_IN_DAY * 60_000);
    return exit;
  }

  function handleSend() {
    const exit = exitDate();
    if (exit > new Date()) return setError("Esa hora todavía no llega. Revisa la hora.");
    setError(null);
    startTransition(async () => {
      try {
        await requestCorrection(
          forgotten.uuid,
          `${storeDateKey(exit)}T${storeHhmm(exit)}:00${STORE_UTC_OFFSET}`,
          reason,
        );
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <Screen>
      <CardHeader className="text-center">
        <Icon icon={HistoryIcon} tone="warning" />
        <CardTitle className="text-xl">No marcaste tu salida</CardTitle>
        <CardDescription>
          El {formatWorkDate(forgotten.workDate)} entraste a las {formatTime(clockInAt)}, pero no
          marcaste salida. ¿A qué hora saliste?
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <TimeStepper value={minutes} onChange={setMinutes} />
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">¿Qué pasó?</span>
          {REASONS.map((option) => (
            <Button
              key={option}
              variant={reason === option ? "secondary" : "outline"}
              className={cn("justify-start", reason === option && "ring-2 ring-primary")}
              onClick={() => setReason(option)}
            >
              {option}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          El administrador revisará tu pedido. Hasta que lo apruebe, ese día figura sin salida.
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button size="lg" disabled={isPending} onClick={handleSend}>
          {isPending ? "Enviando..." : `Salí a las ${toHhmm(minutes)} · Enviar`}
        </Button>
        <Button
          variant="ghost"
          disabled={isPending}
          onClick={() => startTransition(() => skipCorrection(forgotten.uuid))}
        >
          No recuerdo, que lo vea el administrador
        </Button>
      </CardContent>
    </Screen>
  );
}
