"use client";

import { PackageOpenIcon, SearchIcon } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Row = {
  productId: number;
  productName: string;
  categoryName: string;
  byLocation: Record<number, number>;
};

// How much of each product is in the Almacén and in the Tienda. Units only:
// no prices or costs on the warehouse screens.
export function WarehouseStockList({
  locations,
  stock,
}: {
  locations: { id: number; name: string }[];
  stock: Row[];
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const visible = needle
    ? stock.filter(
        (s) =>
          s.productName.toLowerCase().includes(needle) ||
          s.categoryName.toLowerCase().includes(needle),
      )
    : stock;

  if (stock.length === 0) {
    return (
      <EmptyState
        icon={PackageOpenIcon}
        title="Aún no hay productos"
        description="El administrador debe registrar los productos antes de ingresar mercadería."
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stock</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar producto"
            className="pl-8"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <ul className="divide-y">
          {visible.map((row) => (
            <li
              key={row.productId}
              className="flex items-center justify-between gap-3 py-2.5"
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{row.productName}</div>
                <div className="text-xs text-muted-foreground">
                  {row.categoryName}
                </div>
              </div>
              <div className="flex shrink-0 gap-4 text-right">
                {locations.map((location) => {
                  const units = row.byLocation[location.id] ?? 0;
                  return (
                    <div key={location.id} className="flex flex-col leading-tight">
                      <span className="text-xs text-muted-foreground">
                        {location.name}
                      </span>
                      <span
                        className={cn(
                          "font-semibold tabular-nums",
                          units <= 0 && "text-muted-foreground",
                          units < 0 && "text-destructive",
                        )}
                      >
                        {units}
                      </span>
                    </div>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
