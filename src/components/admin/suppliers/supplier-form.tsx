"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createSupplier, updateSupplier } from "@/actions/suppliers";
import { CategoryGlyph } from "@/components/pos/category-glyph";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Supplier } from "@/domain/entities/supplier";
import { isValidRuc } from "@/domain/services/ruc";

export type SupplierCategoryOption = {
  id: number;
  name: string;
  icon: string | null;
};

const FIELDS = [
  "ruc",
  "businessName",
  "tradeName",
  "contactName",
  "phone",
  "email",
  "address",
  "notes",
] as const;
type Field = (typeof FIELDS)[number];
type Values = Record<Field, string>;

function initialValues(supplier?: Supplier): Values {
  return Object.fromEntries(
    FIELDS.map((field) => [field, supplier?.[field] ?? ""]),
  ) as Values;
}

export function SupplierForm({
  supplier,
  categories,
  trigger,
}: {
  supplier?: Supplier;
  categories: SupplierCategoryOption[];
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState<Values>(() => initialValues(supplier));
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const set = (field: Field) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setValues((prev) => ({ ...prev, [field]: event.target.value }));

  // Checked as the 11th digit is typed, before saving.
  const ruc = values.ruc.trim();
  const rucHint =
    ruc.length === 0
      ? "Opcional. 11 dígitos, como figura en la factura."
      : ruc.length < 11
        ? `${ruc.length} de 11 dígitos`
        : isValidRuc(ruc)
          ? "RUC válido"
          : "RUC inválido: revisa los dígitos";
  const rucInvalid = ruc.length === 11 && !isValidRuc(ruc);

  function handleOpenChange(next: boolean) {
    if (next) {
      // Always start from what is saved, not from a cancelled edit.
      setValues(initialValues(supplier));
      setCategoryIds(supplier?.categories.map((c) => String(c.id)) ?? []);
      setError(null);
    }
    setOpen(next);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const input = { ...values, categoryIds: categoryIds.map(Number) };
      const result = supplier
        ? await updateSupplier({ id: supplier.id, ...input })
        : await createSupplier(input);

      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(supplier ? "Proveedor actualizado" : "Proveedor registrado");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {supplier ? "Editar proveedor" : "Nuevo proveedor"}
          </DialogTitle>
          <DialogDescription>
            Empresa o persona a la que le compras mercadería.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="supplier-ruc">RUC</Label>
            <Input
              id="supplier-ruc"
              inputMode="numeric"
              maxLength={11}
              placeholder="20100113610"
              value={values.ruc}
              onChange={(event) =>
                setValues((prev) => ({
                  ...prev,
                  ruc: event.target.value.replace(/\D/g, ""),
                }))
              }
              aria-invalid={rucInvalid}
              className="w-40 font-mono"
            />
            <p
              className={
                rucInvalid
                  ? "text-xs text-destructive"
                  : "text-xs text-muted-foreground"
              }
            >
              {rucHint}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="supplier-business-name">Razón social</Label>
            <Input
              id="supplier-business-name"
              placeholder="Ej. UNIÓN DE CERVECERÍAS PERUANAS BACKUS Y JOHNSTON S.A.A."
              value={values.businessName}
              onChange={set("businessName")}
              maxLength={150}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="supplier-trade-name">Nombre comercial</Label>
            <Input
              id="supplier-trade-name"
              placeholder="Ej. Backus"
              value={values.tradeName}
              onChange={set("tradeName")}
              maxLength={80}
            />
            <p className="text-xs text-muted-foreground">
              El nombre con el que lo conoce tu equipo. Se muestra en las listas.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label id="supplier-categories-label">Categorías que te provee</Label>
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aún no hay categorías.
              </p>
            ) : (
              <ToggleGroup
                aria-labelledby="supplier-categories-label"
                multiple
                value={categoryIds}
                onValueChange={(next) => setCategoryIds(next as string[])}
                variant="outline"
                spacing={1}
                className="flex w-full flex-wrap"
              >
                {categories.map((category) => (
                  <ToggleGroupItem
                    key={category.id}
                    value={String(category.id)}
                    className="aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                  >
                    <CategoryGlyph icon={category.icon} />
                    {category.name}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            )}
            <p className="text-xs text-muted-foreground">
              Puedes marcar varias. Una categoría también puede tener varios
              proveedores.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="supplier-contact">Contacto / vendedor</Label>
              <Input
                id="supplier-contact"
                placeholder="Ej. Juan Pérez"
                value={values.contactName}
                onChange={set("contactName")}
                maxLength={80}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="supplier-phone">Celular</Label>
              <Input
                id="supplier-phone"
                type="tel"
                inputMode="tel"
                placeholder="987 654 321"
                value={values.phone}
                onChange={set("phone")}
                maxLength={15}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="supplier-email">Correo</Label>
            <Input
              id="supplier-email"
              type="email"
              placeholder="Opcional"
              value={values.email}
              onChange={set("email")}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="supplier-address">Dirección</Label>
            <Input
              id="supplier-address"
              placeholder="Opcional"
              value={values.address}
              onChange={set("address")}
              maxLength={200}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="supplier-notes">Notas</Label>
            <Input
              id="supplier-notes"
              placeholder="Ej. Pasa los martes, preventa"
              value={values.notes}
              onChange={set("notes")}
              maxLength={500}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={isPending || rucInvalid}>
              {isPending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
