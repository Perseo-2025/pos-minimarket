import { CheckIcon } from "lucide-react";
import Link from "next/link";
import type { SetupProgress } from "@/application/use-cases/dashboard/setup-progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

// "Primeros pasos": the store's flow in order, each step ticked once it has
// data. Hidden once everything is done.
export function SetupSteps({ progress }: { progress: SetupProgress }) {
  const steps = [
    {
      title: "Crea tus categorías",
      detail: "Bebidas, Snacks… y marca cuáles vencen.",
      href: "/admin/categories",
      done: progress.categories > 0,
    },
    {
      title: "Registra tus proveedores",
      detail: "Con su RUC y las categorías que te traen.",
      href: "/admin/suppliers",
      done: progress.suppliers > 0,
    },
    {
      title: "Registra tus productos",
      detail: "Precio de compra, precio de venta y presentaciones.",
      href: "/admin/products",
      done: progress.products > 0,
    },
    {
      title: "Ingresa la mercadería al Almacén",
      detail: "Cantidades y fechas de vencimiento.",
      href: "/admin/inventory/ingresos/nuevo",
      done: progress.inWarehouse > 0,
    },
    {
      title: "Traslada a la Tienda",
      detail: "Desde ese momento el producto aparece en caja.",
      href: "/admin/inventory/traslados/nuevo",
      done: progress.inStore > 0,
    },
  ];
  if (steps.every((step) => step.done)) return null;
  const next = steps.findIndex((step) => !step.done);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Primeros pasos</CardTitle>
        <CardDescription>
          Sigue este orden y tu caja quedará lista para vender.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col gap-2">
          {steps.map((step, index) => (
            <li key={step.title}>
              <Link
                href={step.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50",
                  index === next && "border-primary bg-primary/5",
                )}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                    step.done
                      ? "bg-emerald-600 text-white"
                      : index === next
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {step.done ? <CheckIcon className="size-4" /> : index + 1}
                </span>
                <span className="flex flex-col leading-tight">
                  <span
                    className={cn(
                      "font-medium",
                      step.done && "text-muted-foreground line-through",
                    )}
                  >
                    {step.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {step.detail}
                  </span>
                </span>
                {index === next && (
                  <span className="ml-auto text-xs font-medium text-primary">
                    Siguiente
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
