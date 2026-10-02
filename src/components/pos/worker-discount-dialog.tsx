"use client";

import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  BadgeCheckIcon,
  BanIcon,
  CheckCircle2Icon,
  CloudOffIcon,
  IdCardIcon,
  Loader2Icon,
  MonitorSmartphoneIcon,
  SearchIcon,
  UserPlusIcon,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { WorkerDiscountUsage } from "@/domain/entities/worker";
import { DNI_PATTERN } from "@/domain/entities/worker";
import { lookupDniOnline, verifyPinOnline } from "@/infrastructure/offline/worker-api";
import {
  findWorkerLocally,
  getWorkerSnapshot,
  localDiscountUsage,
  markWorkerPendingLocally,
  refreshWorkerSnapshot,
  verifyPinOffline,
} from "@/infrastructure/offline/worker-cache";
import { submitWorkerOp, WorkerOpRejectedError } from "@/infrastructure/offline/worker-ops";
import type { CachedWorker } from "@/infrastructure/offline/types";
import { hashPin } from "@/infrastructure/security/pin-hash";
import { cn } from "@/lib/utils";
import { PinPad } from "./pin-pad";

// The worker identified at the till, attached to the current sale only.
export type AppliedWorker = {
  id: number;
  dni: string;
  fullName: string;
  company: string;
  pointsBalance: number;
  verification: "pin_online" | "pin_offline";
  token?: string;
  usage: WorkerDiscountUsage;
  verifiedAt: number;
};

type Flow = "identify" | "register" | "reset";

type Step =
  | { name: "dni" }
  | { name: "pin"; worker: CachedWorker }
  | { name: "not_registered" }
  | { name: "register_form" }
  | { name: "register_pin" }
  | { name: "register_confirm"; firstPin: string }
  | { name: "reset_intro"; worker: CachedWorker }
  | { name: "reset_pin"; worker: CachedWorker }
  | { name: "reset_confirm"; worker: CachedWorker; firstPin: string }
  | { name: "message"; tone: "success" | "warning" | "danger"; title: string; body: string };

const FLOW_STEPS: Record<Flow, string[]> = {
  identify: ["DNI", "Clave del trabajador"],
  register: ["Datos", "Crear clave", "Listo"],
  reset: ["Nueva clave", "Confirmar", "Listo"],
};

function stepPosition(step: Step): { flow: Flow; index: number } | null {
  switch (step.name) {
    case "dni":
    case "not_registered":
      return { flow: "identify", index: 0 };
    case "pin":
      return { flow: "identify", index: 1 };
    case "register_form":
      return { flow: "register", index: 0 };
    case "register_pin":
    case "register_confirm":
      return { flow: "register", index: 1 };
    case "reset_intro":
    case "reset_pin":
      return { flow: "reset", index: 0 };
    case "reset_confirm":
      return { flow: "reset", index: 1 };
    default:
      return null;
  }
}

const TITLES: Record<Flow, string> = {
  identify: "Descuento para trabajador del aeropuerto",
  register: "Registrar trabajador del aeropuerto",
  reset: "Cambiar clave del trabajador",
};

type NameLookup = "loading" | "api" | "manual_not_found" | "manual_unavailable";

export function WorkerDiscountDialog({
  open,
  onOpenChange,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplied: (worker: AppliedWorker) => void;
}) {
  const [step, setStep] = useState<Step>({ name: "dni" });
  const [dni, setDni] = useState("");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Registration form.
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [nameLookup, setNameLookup] = useState<NameLookup>("loading");

  function reset() {
    setStep({ name: "dni" });
    setDni("");
    setPin("");
    setPinError(null);
    setBusy(false);
    setFormError(null);
    setFullName("");
    setCompany("");
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function goTo(next: Step) {
    setPin("");
    setPinError(null);
    setFormError(null);
    setStep(next);
  }

  // ── Step 1: find the worker by DNI ───────────────────────────────────────
  async function searchDni() {
    if (!DNI_PATTERN.test(dni)) {
      setFormError("El DNI debe tener 8 números.");
      return;
    }
    setBusy(true);
    setFormError(null);

    let result = await findWorkerLocally(dni);
    if (result.kind === "unknown" && navigator.onLine) {
      // Maybe registered from another till since the last refresh.
      await refreshWorkerSnapshot({ force: true });
      result = await findWorkerLocally(dni);
    }
    const snapshot = await getWorkerSnapshot();
    setBusy(false);

    if (result.kind === "queued") {
      goTo({
        name: "message",
        tone: "warning",
        title: "Registro aún sin enviar",
        body: "Este DNI se registró en esta tablet sin internet. Cuando vuelva la conexión se enviará, y el administrador deberá aprobarlo. Mientras tanto, la compra va sin descuento.",
      });
      return;
    }

    if (result.kind === "unknown") {
      if (!snapshot && !navigator.onLine) {
        goTo({
          name: "message",
          tone: "warning",
          title: "Sin datos de trabajadores",
          body: "Esta tablet todavía no descargó la lista de trabajadores. Conéctate a internet al menos una vez y vuelve a intentar. Puedes cobrar sin descuento.",
        });
        return;
      }
      goTo({ name: "not_registered" });
      return;
    }

    const worker = result.worker;
    if (worker.status === "pending") {
      goTo({
        name: "message",
        tone: "warning",
        title: `${worker.fullName} está pendiente de aprobación`,
        body: "El administrador aún no aprueba su registro o su cambio de clave. Mientras tanto, sus compras van sin descuento.",
      });
      return;
    }
    if (worker.status !== "active") {
      goTo({
        name: "message",
        tone: "danger",
        title: `${worker.fullName} no tiene descuento`,
        body: "El administrador suspendió el descuento de este trabajador. Cobra la compra a precio normal.",
      });
      return;
    }
    if (!snapshot?.policy) {
      goTo({
        name: "message",
        tone: "warning",
        title: "Descuento no configurado",
        body: "El administrador aún no configuró el descuento para trabajadores. Cobra a precio normal.",
      });
      return;
    }

    goTo({ name: "pin", worker });
  }

  // ── Step 2: the worker types their PIN ───────────────────────────────────
  async function checkPin(worker: CachedWorker, value: string) {
    setBusy(true);
    setPinError(null);

    const online = navigator.onLine ? await verifyPinOnline(worker.dni, value) : null;

    if (online && online.kind !== "unreachable") {
      setBusy(false);
      switch (online.kind) {
        case "ok":
          onApplied({
            ...online.worker,
            verification: "pin_online",
            token: online.token,
            usage: online.usage,
            verifiedAt: Date.now(),
          });
          handleOpenChange(false);
          return;
        case "invalid_pin":
          setPin("");
          setPinError(
            online.attemptsLeft > 0
              ? `Clave incorrecta. Quedan ${online.attemptsLeft} ${online.attemptsLeft === 1 ? "intento" : "intentos"}.`
              : "Clave incorrecta.",
          );
          return;
        case "locked":
          goTo({ name: "message", tone: "danger", title: "Demasiados intentos", body: `${online.message} La compra puede cobrarse sin descuento.` });
          return;
        case "not_active":
          goTo({ name: "message", tone: "warning", title: "Sin descuento por ahora", body: online.message });
          return;
        case "not_found":
          goTo({ name: "not_registered" });
          return;
      }
    }

    // No internet (or the server can't be reached): check against this
    // tablet's copy. The sale is marked "verified offline" for the audit.
    const offline = await verifyPinOffline(worker, value);
    setBusy(false);
    if (offline.ok) {
      onApplied({
        id: worker.id,
        dni: worker.dni,
        fullName: worker.fullName,
        company: worker.company,
        pointsBalance: worker.pointsBalance,
        verification: "pin_offline",
        usage: await localDiscountUsage(worker),
        verifiedAt: Date.now(),
      });
      handleOpenChange(false);
      return;
    }
    if ("lockedMinutes" in offline) {
      goTo({
        name: "message",
        tone: "danger",
        title: "Demasiados intentos",
        body: `Espera ${offline.lockedMinutes} minutos para volver a intentar. La compra puede cobrarse sin descuento.`,
      });
      return;
    }
    setPin("");
    setPinError(
      `Clave incorrecta. Quedan ${offline.attemptsLeft} ${offline.attemptsLeft === 1 ? "intento" : "intentos"}.`,
    );
  }

  // ── Registration ─────────────────────────────────────────────────────────
  async function startRegistration() {
    goTo({ name: "register_form" });
    setFullName("");
    setNameLookup("loading");

    const result = await lookupDniOnline(dni);
    switch (result.status) {
      case "found":
        setFullName(result.fullName);
        setNameLookup("api");
        return;
      case "registered":
        await refreshWorkerSnapshot({ force: true });
        goTo({
          name: "message",
          tone: "warning",
          title: "Este DNI ya está registrado",
          body: `Pertenece a ${result.fullName}. Vuelve a buscarlo para aplicar el descuento.`,
        });
        return;
      case "not_found":
        setNameLookup("manual_not_found");
        return;
      default:
        setNameLookup("manual_unavailable");
    }
  }

  function continueToPin() {
    if (fullName.trim().length < 3) {
      setFormError("Escribe el nombre completo del trabajador.");
      return;
    }
    if (company.trim().length < 2) {
      setFormError("Escribe la empresa donde trabaja.");
      return;
    }
    goTo({ name: "register_pin" });
  }

  async function submitRegistration(value: string) {
    setBusy(true);
    try {
      const pinHash = await hashPin(value);
      const result = await submitWorkerOp({
        id: crypto.randomUUID(),
        op: "register",
        dni,
        label: `Registro de ${dni}`,
        data: {
          uuid: crypto.randomUUID(),
          dni,
          fullName: fullName.trim(),
          nameSource: nameLookup === "api" ? "api" : "manual",
          company: company.trim(),
          pinHash,
          occurredAt: new Date().toISOString(),
        },
      });
      if (result === "sent") void refreshWorkerSnapshot({ force: true });
      goTo({
        name: "message",
        tone: "success",
        title: result === "sent" ? "Registro enviado" : "Registro guardado en la tablet",
        body:
          (result === "sent"
            ? "El administrador debe aprobar al trabajador."
            : "No hay internet: el registro se enviará automáticamente cuando vuelva la conexión. Luego el administrador debe aprobarlo.") +
          " Hasta entonces, sus compras van sin descuento.",
      });
    } catch (error) {
      goTo({ name: "register_form" });
      setFormError(
        error instanceof WorkerOpRejectedError
          ? error.message
          : "No se pudo registrar. Intenta de nuevo.",
      );
    } finally {
      setBusy(false);
    }
  }

  // ── Forgot PIN ───────────────────────────────────────────────────────────
  async function submitPinReset(worker: CachedWorker, value: string) {
    setBusy(true);
    try {
      const pinHash = await hashPin(value);
      const result = await submitWorkerOp({
        id: crypto.randomUUID(),
        op: "pin_reset",
        label: `Cambio de clave de ${worker.dni}`,
        data: {
          uuid: crypto.randomUUID(),
          workerId: worker.id,
          pinHash,
          occurredAt: new Date().toISOString(),
        },
      });
      await markWorkerPendingLocally(worker.id);
      goTo({
        name: "message",
        tone: "success",
        title: "Clave cambiada",
        body:
          (result === "queued"
            ? "Se enviará cuando vuelva la conexión. "
            : "") +
          "Por seguridad, el descuento se reactivará cuando el administrador apruebe el cambio. Esta compra va sin descuento.",
      });
    } catch (error) {
      goTo({ name: "pin", worker });
      setPinError(
        error instanceof WorkerOpRejectedError
          ? error.message
          : "No se pudo cambiar la clave. Intenta de nuevo.",
      );
    } finally {
      setBusy(false);
    }
  }

  function confirmPin(
    first: string,
    second: string,
    onMatch: () => void,
    backTo: Step,
  ) {
    if (first === second) {
      onMatch();
      return;
    }
    goTo(backTo);
    setPinError("Las claves no coinciden. Vuelve a crearla.");
  }

  const position = stepPosition(step);
  const title = position ? TITLES[position.flow] : step.name === "message" ? step.title : "";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">{title}</DialogTitle>
          {position && (
            <StepIndicator steps={FLOW_STEPS[position.flow]} current={position.index} />
          )}
        </DialogHeader>

        {step.name === "dni" && (
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void searchDni();
            }}
          >
            <DialogDescription>
              Pide al trabajador su DNI y escríbelo aquí. Los clientes normales
              (pasajeros) no tienen este descuento.
            </DialogDescription>
            <div className="flex flex-col gap-2">
              <Label htmlFor="worker-dni">DNI del trabajador</Label>
              <Input
                id="worker-dni"
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                maxLength={8}
                placeholder="8 números"
                value={dni}
                onChange={(event) => {
                  setDni(event.target.value.replace(/\D/g, "").slice(0, 8));
                  setFormError(null);
                }}
                className="h-14 text-center text-2xl tracking-[0.3em] tabular-nums"
              />
              {formError && <p className="text-sm text-destructive">{formError}</p>}
            </div>
            <Button type="submit" className="h-12 text-base" disabled={busy || dni.length !== 8}>
              {busy ? <Loader2Icon className="animate-spin" /> : <SearchIcon />}
              Buscar trabajador
            </Button>
          </form>
        )}

        {step.name === "not_registered" && (
          <div className="flex flex-col gap-4">
            <Notice tone="warning" icon={IdCardIcon} title={`El DNI ${dni} no está registrado`}>
              Si es trabajador del aeropuerto, regístralo ahora. El descuento se
              activará cuando el administrador lo apruebe; esta compra va sin
              descuento.
            </Notice>
            <Button className="h-12 text-base" onClick={() => void startRegistration()}>
              <UserPlusIcon />
              Registrar trabajador
            </Button>
            <Button variant="ghost" onClick={() => goTo({ name: "dni" })}>
              <ArrowLeftIcon />
              Corregir DNI
            </Button>
          </div>
        )}

        {step.name === "pin" && (
          <div className="flex flex-col gap-4">
            <WorkerCard worker={step.worker} />
            <HandOverBanner>
              Pide al trabajador que escriba <strong>su clave de 6 números</strong>.
            </HandOverBanner>
            <PinPad
              value={pin}
              onChange={(value) => {
                setPin(value);
                setPinError(null);
              }}
              onComplete={(value) => void checkPin(step.worker, value)}
              disabled={busy}
              error={pinError}
              status={busy ? "Verificando clave…" : null}
            />
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => goTo({ name: "dni" })}>
                <ArrowLeftIcon />
                Otro DNI
              </Button>
              <Button
                variant="link"
                size="sm"
                onClick={() => goTo({ name: "reset_intro", worker: step.worker })}
              >
                ¿Olvidó su clave?
              </Button>
            </div>
          </div>
        )}

        {step.name === "register_form" && (
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              continueToPin();
            }}
          >
            <div className="flex flex-col gap-2">
              <Label>DNI</Label>
              <div className="flex h-10 items-center rounded-lg border bg-muted/40 px-3 font-medium tracking-widest tabular-nums">
                {dni}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="worker-name">Nombre completo</Label>
              <Input
                id="worker-name"
                value={nameLookup === "loading" ? "" : fullName}
                placeholder={nameLookup === "loading" ? "Consultando RENIEC…" : "Tal como figura en el DNI"}
                readOnly={nameLookup === "api" || nameLookup === "loading"}
                onChange={(event) => setFullName(event.target.value)}
                className={cn(nameLookup === "api" && "bg-muted/40 font-medium")}
              />
              <NameLookupHint state={nameLookup} />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="worker-company">Empresa donde trabaja</Label>
              <Input
                id="worker-company"
                placeholder="Ej. LATAM, Lima Airport Partners, Seguridad…"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                autoComplete="off"
              />
            </div>

            {formError && (
              <Notice tone="danger" icon={AlertTriangleIcon} title="No se pudo continuar">
                {formError}
              </Notice>
            )}

            <Button type="submit" className="h-12 text-base" disabled={nameLookup === "loading"}>
              Siguiente: el trabajador crea su clave
            </Button>
            <Button type="button" variant="ghost" onClick={() => goTo({ name: "dni" })}>
              <ArrowLeftIcon />
              Cancelar
            </Button>
          </form>
        )}

        {(step.name === "register_pin" || step.name === "reset_pin") && (
          <div className="flex flex-col gap-4">
            <HandOverBanner>
              El trabajador crea <strong>su clave de 6 números</strong>. La usará en
              cada compra; no debe compartirla con nadie.
            </HandOverBanner>
            <PinPad
              value={pin}
              onChange={(value) => {
                setPin(value);
                setPinError(null);
              }}
              onComplete={(value) =>
                goTo(
                  step.name === "register_pin"
                    ? { name: "register_confirm", firstPin: value }
                    : { name: "reset_confirm", worker: step.worker, firstPin: value },
                )
              }
              error={pinError}
            />
          </div>
        )}

        {(step.name === "register_confirm" || step.name === "reset_confirm") && (
          <div className="flex flex-col gap-4">
            <HandOverBanner>
              Escribe <strong>la misma clave otra vez</strong> para confirmarla.
            </HandOverBanner>
            <PinPad
              value={pin}
              onChange={setPin}
              disabled={busy}
              status={busy ? "Guardando…" : null}
              onComplete={(value) =>
                step.name === "register_confirm"
                  ? confirmPin(step.firstPin, value, () => void submitRegistration(value), {
                      name: "register_pin",
                    })
                  : confirmPin(
                      step.firstPin,
                      value,
                      () => void submitPinReset(step.worker, value),
                      { name: "reset_pin", worker: step.worker },
                    )
              }
            />
          </div>
        )}

        {step.name === "reset_intro" && (
          <div className="flex flex-col gap-4">
            <WorkerCard worker={step.worker} />
            <Notice tone="warning" icon={AlertTriangleIcon} title="Antes de continuar">
              El trabajador creará una clave nueva. Por seguridad, su descuento
              quedará en pausa hasta que el administrador apruebe el cambio. Esta
              compra va sin descuento.
            </Notice>
            <Button className="h-12 text-base" onClick={() => goTo({ name: "reset_pin", worker: step.worker })}>
              Continuar: crear clave nueva
            </Button>
            <Button variant="ghost" onClick={() => goTo({ name: "pin", worker: step.worker })}>
              <ArrowLeftIcon />
              Volver
            </Button>
          </div>
        )}

        {step.name === "message" && (
          <div className="flex flex-col gap-4">
            <Notice
              tone={step.tone}
              icon={step.tone === "success" ? CheckCircle2Icon : step.tone === "danger" ? BanIcon : AlertTriangleIcon}
              title={step.tone === "success" ? "Listo" : "Importante"}
            >
              {step.body}
            </Notice>
            <Button className="h-12 text-base" onClick={() => handleOpenChange(false)}>
              Entendido
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StepIndicator({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center gap-2 text-xs" aria-label="Pasos">
      {steps.map((label, i) => (
        <li key={label} className="flex items-center gap-2">
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium",
              i === current
                ? "bg-primary text-primary-foreground"
                : i < current
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground",
            )}
            aria-current={i === current ? "step" : undefined}
          >
            <span className="tabular-nums">{i + 1}</span>
            {label}
          </span>
          {i < steps.length - 1 && <span aria-hidden className="h-px w-3 bg-border" />}
        </li>
      ))}
    </ol>
  );
}

function WorkerCard({ worker }: { worker: CachedWorker }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <BadgeCheckIcon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 leading-tight">
        <p className="truncate font-semibold">{worker.fullName}</p>
        <p className="truncate text-sm text-muted-foreground">
          {worker.company} · DNI {worker.dni}
        </p>
      </div>
    </div>
  );
}

// The key moment of the anti-fraud flow: the cashier hands the screen over,
// so only the worker sees and types the PIN.
function HandOverBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-brand-blue/30 bg-brand-blue/10 p-3 text-sm">
      <MonitorSmartphoneIcon className="mt-0.5 size-5 shrink-0 text-brand-blue" aria-hidden />
      <div className="space-y-0.5">
        <p className="font-semibold">Gira la pantalla hacia el trabajador</p>
        <p className="text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}

function NameLookupHint({ state }: { state: NameLookup }) {
  if (state === "loading") {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2Icon className="size-3.5 animate-spin" /> Consultando RENIEC…
      </p>
    );
  }
  if (state === "api") {
    return (
      <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
        <BadgeCheckIcon className="size-3.5" /> Nombre obtenido de RENIEC
      </p>
    );
  }
  return (
    <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
      <CloudOffIcon className="mt-px size-3.5 shrink-0" />
      {state === "manual_not_found"
        ? "RENIEC no encontró este DNI. Verifica el número y escribe el nombre tal como figura en el DNI."
        : "No se pudo consultar RENIEC (sin internet o servicio no disponible). Escribe el nombre tal como figura en el DNI."}
    </p>
  );
}

const NOTICE_TONES = {
  success: "border-emerald-500/30 bg-emerald-500/10 [&_svg]:text-emerald-600",
  warning: "border-amber-500/30 bg-amber-500/10 [&_svg]:text-amber-600",
  danger: "border-destructive/30 bg-destructive/10 [&_svg]:text-destructive",
} as const;

function Notice({
  tone,
  icon: Icon,
  title,
  children,
}: {
  tone: keyof typeof NOTICE_TONES;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex items-start gap-3 rounded-xl border p-3 text-sm", NOTICE_TONES[tone])}>
      <Icon className="mt-0.5 size-5 shrink-0" />
      <div className="space-y-0.5">
        <p className="font-semibold">{title}</p>
        <p className="text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}
