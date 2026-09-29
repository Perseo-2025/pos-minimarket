"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { round2 } from "@/domain/value-objects/money";
import { formatSoles } from "@/lib/money";

const PRESETS = [0, 10, 20, 50];
const CUSTOM = "custom";

// Worker discount for one product: quick presets plus a custom 1–99%.
// 100% is intentionally not offered — giving a product away is a courtesy
// approved by an admin at the till, sale by sale.
export function WorkerDiscountField({
  value,
  onChange,
  price,
}: {
  value: number;
  onChange: (value: number) => void;
  // Current sale price, to show the cashier-facing example.
  price: number;
}) {
  const [custom, setCustom] = useState(!PRESETS.includes(value));
  const selected = custom ? CUSTOM : String(value);
  const discount = value > 0 && price > 0 ? round2((price * value) / 100) : 0;

  return (
    <div className="flex flex-col gap-2">
      <ToggleGroup
        aria-labelledby="worker-discount-label"
        value={[selected]}
        onValueChange={(next) => {
          const [choice] = next as string[];
          if (!choice) return; // a discount option is always selected
          if (choice === CUSTOM) {
            setCustom(true);
            if (PRESETS.includes(value)) onChange(5);
          } else {
            setCustom(false);
            onChange(Number(choice));
          }
        }}
        variant="outline"
        spacing={1}
        className="grid w-full grid-cols-5"
      >
        {PRESETS.map((preset) => (
          <ToggleGroupItem
            key={preset}
            value={String(preset)}
            className="aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
          >
            {preset === 0 ? "Sin" : `${preset}%`}
          </ToggleGroupItem>
        ))}
        <ToggleGroupItem
          value={CUSTOM}
          className="aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
        >
          Otro
        </ToggleGroupItem>
      </ToggleGroup>

      {custom && (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            aria-label="Porcentaje de descuento personalizado"
            min={1}
            max={99}
            step={1}
            value={value}
            onChange={(event) => onChange(Number(event.target.value))}
            className="w-24"
          />
          <span className="text-sm text-muted-foreground">% (1 a 99)</span>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {value > 0 && price > 0
          ? `Un trabajador identificado paga ${formatSoles(round2(price - discount))} (ahorra ${formatSoles(discount)}). Los demás clientes pagan ${formatSoles(price)}.`
          : value > 0
            ? "Solo lo reciben los trabajadores identificados con DNI y clave."
            : "Este producto se cobra a precio completo a todos."}{" "}
        Para regalarlo (100%) usa <strong>Cortesía</strong> en caja.
      </p>
    </div>
  );
}
