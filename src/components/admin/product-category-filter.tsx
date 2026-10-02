"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CategoryOption } from "./product-form";

const ALL = "all";

// The filter lives in the URL (?category=…) so the "Ver productos" links on
// the Categorías page land on an already-filtered list.
export function ProductCategoryFilter({
  categories,
  selected,
}: {
  categories: CategoryOption[];
  selected: number | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const items = [
    { value: ALL, label: "Todas las categorías" },
    // Select values are strings here (they end up in the URL).
    ...categories.map((c) => ({
      value: String(c.id),
      label: c.isActive ? c.name : `${c.name} (inactiva)`,
    })),
  ];

  return (
    <Select
      value={selected === null ? ALL : String(selected)}
      items={items}
      onValueChange={(value) =>
        startTransition(() =>
          router.push(
            !value || value === ALL
              ? "/admin/products"
              : `/admin/products?category=${value}`,
          ),
        )
      }
    >
      <SelectTrigger
        aria-label="Filtrar por categoría"
        aria-busy={isPending}
        className="w-full sm:w-56"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
