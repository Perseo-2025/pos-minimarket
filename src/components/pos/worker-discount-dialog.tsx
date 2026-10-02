"use client";

import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  BadgeCheckIcon,
  BanIcon,
  CakeIcon,
  CheckCircle2Icon,
  CloudOffIcon,
  IdCardIcon,
  Loader2Icon,
  SearchIcon,
  UserPlusIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { BirthDateInput } from "@/components/birth-date-input";
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
import { DNI_PATTERN, type WorkerDiscountUsage } from "@/domain/entities/worker";
import { birthdayGiftAvailable } from "@/domain/services/birthday";
import { birthDateSchema } from "@/application/validation/worker";
import { lookupDniOnline } from "@/infrastructure/offline/worker-api";
import {
  findWorkerLocally,
  getWorkerSnapshot,
  localDiscountUsage,
  refreshWorkerSnapshot,
} from "@/infrastructure/offline/worker-cache";
import { submitWorkerOp, WorkerOpRejectedError } from "@/infrastructure/offline/worker-ops";
import type { CachedPolicy, CachedWorker } from "@/infrastructure/offline/types";
import { formatSoles } from "@/lib/money";
import { cn } from "@/lib/utils";

// The worker identified at the till, attached to the current sale only.
export type AppliedWorker = {
  id: number;
  dni: string;
  fullName: string;
  company: string;
  birthDate: string | null;
  pointsBalance: number;
  usage: WorkerDiscountUsage;
};

type Step =
  | { name: "dni" }
  | { name: "confirm"; worker: CachedWorker; policy: CachedPolicy; usage: WorkerDiscountUsage }
  | { name: "not_registered" }
  | { name: "register_form" }
  | { name: "message"; tone: "success" | "warning" | "danger"; title: string; body: string };

type NameLookup = "loading" | "api" | "manual_not_found" | "manual_unavailable";

export function WorkerDiscountDialog({
  open,
  onOpenChange,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplied: (worker: AppliedWorker, policy: CachedPolicy) => void;
}) {
  const [step, setStep] = useState<Step>({ name: "dni" });
  const [dni, setDni] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // Typing the 8th digit searches right away; this stops a double search
  // when the cashier also presses Enter.
  const searching = useRef(false);

  // Registration form.
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [birthDate, setBirthDate] = useState<string | null>(null);
  const [nameLookup, setNameLookup] = useState<NameLookup>("loading");

  function reset() {
    setStep({ name: "dni" });
    setDni("");
    setBusy(false);
    setFormError(null);
    setFullName("");
    setCompany("");
    setBirthDate(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function goTo(next: Step) {
    setFormError(null);
    setStep(next);
  }

  // ── Find the worker by DNI ───────────────────────────────────────────────
  async function searchDni(value: string) {
    if (!DNI_PATTERN.test(value)) {
      setFormError("El DNI debe tener 8 números.");
      return;
    }
    if (searching.current) return;
    searching.current = true;
    setBusy(true);
    setFormError(null);

    try {
      // Fresh usage when there is internet (another till may have sold to
      // this worker); throttled, and skipped offline.
      await refreshWorkerSnapshot();
      let result = await findWorkerLocally(value);
      if (result.kind === "unknown" && navigator.onLine) {
        // Maybe registered from another till since the last refresh.
        await refreshWorkerSnapshot({ force: true });
        result = await findWorkerLocally(value);
      }
      const snapshot = await getWorkerSnapshot();

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
          body: "El administrador aún no aprueba su registro. Mientras tanto, sus compras van sin descuento.",
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

      goTo({
        name: "confirm",
        worker,
        policy: snapshot.policy,
        usage: await localDiscountUsage(worker),
      });
    } finally {
      searching.current = false;
      setBusy(false);
    }
  }

  function apply(worker: CachedWorker, policy: CachedPolicy, usage: WorkerDiscountUsage) {
    onApplied(
      {
        id: worker.id,
        dni: worker.dni,
        fullName: worker.fullName,
        company: worker.company,
        birthDate: worker.birthDate,
        pointsBalance: worker.pointsBalance,
        usage,
      },
      policy,
    );
    handleOpenChange(false);
  }

  // ── Registration ─────────────────────────────────────────────────────────
  async function startRegistration() {
    goTo({ name: "register_form" });
    setFullName("");
    setBirthDate(null);
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

  async function submitRegistration() {
    if (fullName.trim().length < 3) {
      setFormError("Escribe el nombre completo del trabajador.");
      return;
    }
    if (company.trim().length < 2) {
      setFormError("Escribe la empresa donde trabaja.");
      return;
    }
    const validBirthDate = birthDate && birthDateSchema.safeParse(birthDate).success;
    if (!validBirthDate) {
      setFormError("Revisa la fecha de nacimiento (día/mes/año, como en su DNI).");
      return;
    }

    setBusy(true);
    try {
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
          birthDate,
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
      setFormError(
        error instanceof WorkerOpRejectedError
          ? error.message
          : "No se pudo registrar. Intenta de nuevo.",
      );
    } finally {
      setBusy(false);
    }
  }

  const title =
    step.name === "message"
      ? step.title
      : step.name === "register_form"
        ? "Registrar trabajador del aeropuerto"
        : "Descuento para trabajador del aeropuerto";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">{title}</DialogTitle>
        </DialogHeader>

        {step.name === "dni" && (
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void searchDni(dni);
            }}
          >
            <DialogDescription>
              Pide al trabajador su fotocheck y escribe su DNI. Los clientes
              normales (pasajeros) no tienen este descuento.
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
                disabled={busy}
                onChange={(event) => {
                  const value = event.target.value.replace(/\D/g, "").slice(0, 8);
                  setDni(value);
                  setFormError(null);
                  if (value.length === 8) void searchDni(value);
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

        {step.name === "confirm" && (
          <ConfirmWorker
            worker={step.worker}
            policy={step.policy}
            usage={step.usage}
            onApply={() => apply(step.worker, step.policy, step.usage)}
            onBack={() => {
              setDni("");
              goTo({ name: "dni" });
            }}
          />
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
            <Button
              variant="ghost"
              onClick={() => {
                setDni("");
                goTo({ name: "dni" });
              }}
            >
              <ArrowLeftIcon />
              Corregir DNI
            </Button>
          </div>
        )}

        {step.name === "register_form" && (
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submitRegistration();
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

            <div className="flex flex-col gap-2">
              <Label htmlFor="worker-birth-date">Fecha de nacimiento</Label>
              <BirthDateInput
                id="worker-birth-date"
                onChange={setBirthDate}
                className="tabular-nums tracking-wider"
              />
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CakeIcon className="size-3.5" aria-hidden />
                Cópiala de su DNI. El día de su cumpleaños recibe un regalo.
              </p>
            </div>

            {formError && (
              <Notice tone="danger" icon={AlertTriangleIcon} title="No se pudo registrar">
                {formError}
              </Notice>
            )}

            <Button type="submit" className="h-12 text-base" disabled={busy || nameLookup === "loading"}>
              {busy ? <Loader2Icon className="animate-spin" /> : <UserPlusIcon />}
              Registrar trabajador
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDni("");
                goTo({ name: "dni" });
              }}
            >
              <ArrowLeftIcon />
              Cancelar
            </Button>
          </form>
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
            <Button className="h-12 text-base" autoFocus onClick={() => handleOpenChange(false)}>
              Entendido
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// The cashier compares the name with the worker's fotocheck and applies the
// discount with one tap (or Enter).
function ConfirmWorker({
  worker,
  policy,
  usage,
  onApply,
  onBack,
}: {
  worker: CachedWorker;
  policy: CachedPolicy;
  usage: WorkerDiscountUsage;
  onApply: () => void;
  onBack: () => void;
}) {
  const purchasesLeft = Math.max(0, policy.maxDiscountedSalesPerDay - usage.discountedSalesToday);
  const birthday = birthdayGiftAvailable({
    birthDate: worker.birthDate,
    giftUsedThisYear: usage.giftUsedThisYear,
    giftMaxAmount: policy.birthdayGiftMaxAmount,
    at: new Date(),
  });

  return (
    <div className="flex flex-col gap-4">
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
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <IdCardIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
        Verifica que el nombre coincida con su fotocheck.
      </p>

      {birthday && (
        <Notice tone="success" icon={CakeIcon} title="¡Hoy es su cumpleaños!">
          Puede llevar 1 producto gratis de hasta {formatSoles(policy.birthdayGiftMaxAmount)}.
          Márcalo con 🎂 en la cesta.
        </Notice>
      )}
      {purchasesLeft === 0 ? (
        <Notice tone="warning" icon={AlertTriangleIcon} title="Ya usó sus descuentos de hoy">
          Sus {policy.maxDiscountedSalesPerDay} compras con descuento del día ya se usaron.
          Esta compra va a precio normal, pero suma puntos.
        </Notice>
      ) : (
        <p className="text-sm text-muted-foreground">
          Descuento en las primeras {policy.maxDiscountedUnitsPerSale} unidades ·{" "}
          {purchasesLeft === 1
            ? "última compra con descuento de hoy"
            : `le quedan ${purchasesLeft} compras con descuento hoy`}
        </p>
      )}

      <Button className="h-12 text-base" autoFocus onClick={onApply}>
        <CheckCircle2Icon />
        Aplicar al trabajador
      </Button>
      <Button variant="ghost" onClick={onBack}>
        <ArrowLeftIcon />
        Otro DNI
      </Button>
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
