"use client";

import {
  CakeIcon,
  CloudOffIcon,
  KeyRoundIcon,
  RefreshCwIcon,
  UserPlusIcon,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  getWorkerDetail,
  refreshWorkerName,
  setWorkerStatus,
  updateWorkerBirthDate,
} from "@/actions/workers";
import { BirthDateInput, formatBirthDate } from "@/components/birth-date-input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";
import type { WorkerAction } from "@/application/use-cases/workers/manage-workers";
import {
  AUDIT_FLAG_LABELS,
  INFO_AUDIT_FLAGS,
  type AuditFlag,
} from "@/domain/entities/audit";
import type {
  WorkerNameSource,
  WorkerPendingReason,
  WorkerStatus,
} from "@/domain/entities/worker";
import { isBirthdayAt } from "@/domain/services/birthday";
import { usePagination } from "@/hooks/use-pagination";
import { formatSoles } from "@/lib/money";
import { DataTable, ID_COLUMN, IdCell } from "../data-table";
import { DataTablePagination } from "../data-table-pagination";
import { WorkerStatusBadge } from "./worker-status-badge";

export type WorkerRow = {
  id: number;
  dni: string;
  fullName: string;
  nameSource: WorkerNameSource;
  company: string;
  // YYYY-MM-DD; null on workers registered before it was asked.
  birthDate: string | null;
  status: WorkerStatus;
  pendingReason: WorkerPendingReason | null;
  pointsBalance: number;
  registeredByName: string | null;
  createdAt: string;
};

type Detail = Extract<Awaited<ReturnType<typeof getWorkerDetail>>, { ok: true }>["data"];

const COLUMNS = [
  ID_COLUMN,
  { label: "Trabajador" },
  { label: "Empresa" },
  { label: "Cumpleaños" },
  { label: "Estado" },
  { label: "Registrado por" },
  { label: "Puntos", className: "text-right" },
  { label: "Acciones", className: "text-right" },
];

const dateFormat = new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" });
const dateTimeFormat = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "medium",
  timeStyle: "short",
});

const ACTION_MESSAGES: Record<WorkerAction, string> = {
  approve: "Trabajador aprobado: ya tiene descuento",
  reject: "Registro rechazado",
  suspend: "Descuento suspendido",
  reactivate: "Trabajador reactivado",
};

export function WorkerTable({
  workers,
  emptyMessage,
}: {
  workers: WorkerRow[];
  emptyMessage: string;
}) {
  const [isPending, startTransition] = useTransition();
  const pagination = usePagination(workers);
  const [selected, setSelected] = useState<WorkerRow | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);

  function run(worker: WorkerRow, action: WorkerAction) {
    startTransition(async () => {
      const result = await setWorkerStatus(worker.id, action);
      if (result.ok) toast.success(ACTION_MESSAGES[action], { description: worker.fullName });
      else toast.error(result.error);
    });
  }

  function openDetail(worker: WorkerRow) {
    setSelected(worker);
    setDetail(null);
    void getWorkerDetail(worker.id).then((result) => {
      if (result.ok) setDetail(result.data);
      else toast.error(result.error);
    });
  }

  function checkReniec(worker: WorkerRow) {
    startTransition(async () => {
      const result = await refreshWorkerName(worker.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.data.changed ? "Nombre corregido con RENIEC" : "El nombre coincide con RENIEC",
        { description: result.data.fullName },
      );
    });
  }

  return (
    <>
      <DataTable
        columns={COLUMNS}
        isEmpty={workers.length === 0}
        emptyMessage={emptyMessage}
        footer={
          <DataTablePagination
            {...pagination}
            onPageChange={pagination.setPage}
            itemLabel="trabajadores"
          />
        }
      >
        {pagination.rows.map((worker) => (
          <TableRow key={worker.id}>
            <IdCell id={worker.id} />
            <TableCell>
              <button
                type="button"
                className="text-left leading-tight hover:underline"
                onClick={() => openDetail(worker)}
              >
                <div className="font-medium">{worker.fullName}</div>
                <div className="text-xs text-muted-foreground tabular-nums">
                  DNI {worker.dni}
                </div>
              </button>
              {worker.nameSource === "manual" && (
                <Badge
                  variant="outline"
                  className="mt-1 border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                >
                  <CloudOffIcon />
                  Nombre escrito a mano
                </Badge>
              )}
            </TableCell>
            <TableCell>{worker.company}</TableCell>
            <TableCell>
              <BirthdayCell birthDate={worker.birthDate} />
            </TableCell>
            <TableCell>
              <div className="flex flex-col items-start gap-1">
                <WorkerStatusBadge status={worker.status} />
                {worker.pendingReason && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    {worker.pendingReason === "pin_reset" ? (
                      <KeyRoundIcon className="size-3" />
                    ) : (
                      <UserPlusIcon className="size-3" />
                    )}
                    {worker.pendingReason === "pin_reset" ? "Cambió su clave" : "Nuevo registro"}
                  </span>
                )}
              </div>
            </TableCell>
            <TableCell className="text-sm">
              <div>{worker.registeredByName ?? "—"}</div>
              <div className="text-xs text-muted-foreground">
                {dateFormat.format(new Date(worker.createdAt))}
              </div>
            </TableCell>
            <TableCell className="text-right tabular-nums">{worker.pointsBalance}</TableCell>
            <TableCell className="text-right">
              <div className="flex flex-wrap justify-end gap-1.5">
                {worker.nameSource === "manual" && worker.status === "pending" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isPending}
                    onClick={() => checkReniec(worker)}
                  >
                    <RefreshCwIcon />
                    Consultar RENIEC
                  </Button>
                )}
                {worker.status === "pending" && (
                  <>
                    <ConfirmButton
                      label="Rechazar"
                      title={`¿Rechazar a ${worker.fullName}?`}
                      description="No recibirá descuento. Usa esta opción si no es trabajador del aeropuerto o si sus datos no son correctos."
                      confirmLabel="Rechazar"
                      destructive
                      disabled={isPending}
                      onConfirm={() => run(worker, "reject")}
                    />
                    <Button size="sm" disabled={isPending} onClick={() => run(worker, "approve")}>
                      {worker.pendingReason === "pin_reset" ? "Aprobar cambio" : "Aprobar"}
                    </Button>
                  </>
                )}
                {worker.status === "active" && (
                  <ConfirmButton
                    label="Suspender"
                    title={`¿Suspender el descuento de ${worker.fullName}?`}
                    description="Dejará de recibir descuento hasta que lo reactives. Útil si dejó de trabajar en el aeropuerto o se sospecha mal uso."
                    confirmLabel="Suspender"
                    destructive
                    disabled={isPending}
                    onConfirm={() => run(worker, "suspend")}
                  />
                )}
                {worker.status === "suspended" && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => run(worker, "reactivate")}
                  >
                    Reactivar
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </DataTable>

      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-md">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.fullName}</SheetTitle>
                <SheetDescription>
                  DNI {selected.dni} · {selected.company}
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
                <dl className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Estado</dt>
                    <dd className="mt-0.5">
                      <WorkerStatusBadge status={selected.status} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Puntos acumulados</dt>
                    <dd className="text-lg font-semibold tabular-nums">
                      {selected.pointsBalance}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Registrado por</dt>
                    <dd className="font-medium">{selected.registeredByName ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Nombre</dt>
                    <dd className="font-medium">
                      {selected.nameSource === "api" ? "Verificado RENIEC" : "Escrito a mano"}
                    </dd>
                  </div>
                </dl>

                <BirthDateEditor
                  key={selected.id}
                  workerId={selected.id}
                  birthDate={selected.birthDate}
                  onSaved={(birthDate) => setSelected({ ...selected, birthDate })}
                />

                <div>
                  <h3 className="mb-2 text-sm font-semibold">Últimas compras</h3>
                  {!detail ? (
                    <div className="space-y-2">
                      <Skeleton className="h-12" />
                      <Skeleton className="h-12" />
                    </div>
                  ) : detail.purchases.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aún no tiene compras.</p>
                  ) : (
                    <ul className="divide-y rounded-lg border">
                      {detail.purchases.map((purchase) => {
                        const flags = (purchase.auditFlags as AuditFlag[]).filter(
                          (f) => !INFO_AUDIT_FLAGS.includes(f),
                        );
                        return (
                          <li key={purchase.saleId} className="space-y-1 p-3 text-sm">
                            <div className="flex justify-between gap-2">
                              <span className="text-muted-foreground">
                                <span className="font-mono font-medium text-foreground">
                                  Orden #{purchase.saleId}
                                </span>{" "}
                                · {dateTimeFormat.format(new Date(purchase.clientCreatedAt))}
                              </span>
                              <span className="font-semibold tabular-nums">
                                {formatSoles(purchase.total)}
                              </span>
                            </div>
                            <div className="flex justify-between gap-2 text-xs text-muted-foreground">
                              <span>Cajero: {purchase.cashierName ?? "—"}</span>
                              <span className="tabular-nums">
                                {purchase.discountTotal > 0
                                  ? `−${formatSoles(purchase.discountTotal)}`
                                  : "Sin descuento"}
                                {purchase.giftTotal > 0 &&
                                  ` · regalo 🎂 ${formatSoles(purchase.giftTotal)}`}{" "}
                                · +{purchase.pointsEarned} pts
                              </span>
                            </div>
                            {flags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {flags.map((flag) => (
                                  <Badge key={flag} variant="destructive">
                                    {AUDIT_FLAG_LABELS[flag]}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function ConfirmButton({
  label,
  title,
  description,
  confirmLabel,
  destructive,
  disabled,
  onConfirm,
}: {
  label: string;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  disabled?: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            size="sm"
            variant="ghost"
            disabled={disabled}
            className={
              destructive
                ? "text-destructive hover:bg-destructive/10 hover:text-destructive"
                : undefined
            }
          >
            {label}
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className={destructive ? "bg-destructive text-white hover:bg-destructive/90" : undefined}
            onClick={onConfirm}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function BirthdayCell({ birthDate }: { birthDate: string | null }) {
  if (!birthDate) {
    return (
      <Badge
        variant="outline"
        className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
      >
        Falta la fecha
      </Badge>
    );
  }
  return (
    <div className="flex flex-col items-start gap-1 text-sm tabular-nums">
      {formatBirthDate(birthDate).slice(0, 5)}
      {isBirthdayAt(birthDate, new Date()) && (
        <Badge className="bg-brand-orange text-white">
          <CakeIcon />
          Hoy
        </Badge>
      )}
    </div>
  );
}

// Workers registered before the birth date was asked have none: the admin
// fills it in here (and fixes typos), or they get no birthday gift.
function BirthDateEditor({
  workerId,
  birthDate,
  onSaved,
}: {
  workerId: number;
  birthDate: string | null;
  onSaved: (birthDate: string) => void;
}) {
  const [value, setValue] = useState<string | null>(birthDate);
  const [isPending, startTransition] = useTransition();
  const changed = value !== null && value !== birthDate;

  function save() {
    if (!value) return;
    startTransition(async () => {
      const result = await updateWorkerBirthDate(workerId, value);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Fecha de nacimiento guardada");
      onSaved(value);
    });
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border p-3">
      <label htmlFor="birth-date-edit" className="flex items-center gap-1.5 text-sm font-semibold">
        <CakeIcon className="size-4 text-brand-orange" aria-hidden />
        Fecha de nacimiento
      </label>
      <div className="flex gap-2">
        <BirthDateInput
          id="birth-date-edit"
          defaultValue={birthDate}
          onChange={setValue}
          className="tabular-nums tracking-wider"
        />
        <Button disabled={!changed || isPending} onClick={save}>
          {isPending ? "Guardando…" : "Guardar"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {birthDate
          ? "El día de su cumpleaños la caja ofrece su regalo."
          : "Sin fecha no recibe regalo de cumpleaños. Cópiala de su DNI."}
      </p>
    </div>
  );
}
