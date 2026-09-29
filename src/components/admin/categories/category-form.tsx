"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createCategory, updateCategory } from "@/actions/categories";
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
import {
  CATEGORY_ICON_LABELS,
  CATEGORY_ICONS,
  type CategoryIcon,
} from "@/domain/entities/category";
import { CATEGORY_ICON_COMPONENTS } from "@/components/pos/pos-icons";

export type EditableCategory = {
  id: string;
  name: string;
  icon: CategoryIcon | null;
  sortOrder: number;
};

export function CategoryForm({
  category,
  trigger,
  nextSortOrder = 0,
}: {
  category?: EditableCategory;
  trigger: React.ReactElement;
  // Default position for a new category: after the last existing one.
  nextSortOrder?: number;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<CategoryIcon | null>(null);
  const [sortOrder, setSortOrder] = useState("0");
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    if (next) {
      // Always start from what is saved, not from a cancelled edit.
      setName(category?.name ?? "");
      setIcon(category?.icon ?? null);
      setSortOrder(String(category?.sortOrder ?? nextSortOrder));
      setError(null);
    }
    setOpen(next);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const input = { name, icon, sortOrder };
      const result = category
        ? await updateCategory({ id: category.id, ...input })
        : await createCategory(input);

      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(category ? "Categoría actualizada" : "Categoría creada");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {category ? "Editar categoría" : "Nueva categoría"}
          </DialogTitle>
          <DialogDescription>
            Las categorías agrupan los productos en la caja.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="category-name">Nombre</Label>
            <Input
              id="category-name"
              value={name}
              maxLength={40}
              placeholder="Ej. Lácteos"
              onChange={(event) => setName(event.target.value)}
              aria-invalid={error !== null}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label id="category-icon-label">Ícono</Label>
            <ToggleGroup
              aria-labelledby="category-icon-label"
              value={icon ? [icon] : []}
              // Clicking the selected icon again clears it (icon is optional).
              onValueChange={(next) =>
                setIcon((next[0] as CategoryIcon | undefined) ?? null)
              }
              variant="outline"
              spacing={1}
              className="grid w-full grid-cols-7 sm:grid-cols-9"
            >
              {CATEGORY_ICONS.map((key) => {
                const Icon = CATEGORY_ICON_COMPONENTS[key];
                return (
                  <ToggleGroupItem
                    key={key}
                    value={key}
                    aria-label={CATEGORY_ICON_LABELS[key]}
                    title={CATEGORY_ICON_LABELS[key]}
                    className="aspect-square h-auto w-full aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground [&_svg:not([class*='size-'])]:size-5"
                  >
                    <Icon />
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
            <p className="text-xs text-muted-foreground">
              {icon
                ? `Seleccionado: ${CATEGORY_ICON_LABELS[icon]}`
                : "Opcional. Sin ícono se muestra una etiqueta genérica."}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="category-order">Orden en caja</Label>
            <Input
              id="category-order"
              type="number"
              min={0}
              max={999}
              step={1}
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
              className="w-28"
            />
            <p className="text-xs text-muted-foreground">
              Las categorías con número menor aparecen primero.
            </p>
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
