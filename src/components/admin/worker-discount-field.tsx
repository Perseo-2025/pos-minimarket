"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { round2 } from "@/domain/value-objects/money";
import { formatSoles } from "@/lib/money";

const PRESETS = [0, 0.5, 1, 2];
const CUSTOM = "custom";

function presetLabel(amount: number) {
  if (amount === 0) return "Sin";
  return Number.isInteger(amount) ? `S/ ${amount}` : `S/ ${amount.toFixed(2)}`;
}

// Worker discount for one product, in soles off each unit: quick presets
// plus any other amount. It must stay below the price — a worker never gets
// a product for free (only the birthday gift, decided at the till).
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
  const tooHigh = value > 0 && price > 0 && value >= price;

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
            {presetLabel(preset)}
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
          <span className="text-sm text-muted-foreground">S/</span>
          <Input
            type="number"
            inputMode="decimal"
            aria-label="Monto de descuento personalizado en soles"
            min={0}
            step={0.1}
            value={value}
            onChange={(event) => onChange(round2(Number(event.target.value) || 0))}
            className="w-28"
          />
          <span className="text-sm text-muted-foreground">por unidad</span>
        </div>
      )}

      <p className={tooHigh ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
        {tooHigh
          ? `El descuento debe ser menor que el precio (${formatSoles(price)}).`
          : value > 0 && price > 0
            ? `Un trabajador del aeropuerto paga ${formatSoles(round2(price - value))} (ahorra ${formatSoles(value)}). Los demás clientes pagan ${formatSoles(price)}.`
            : value > 0
              ? "Solo lo reciben los trabajadores del aeropuerto registrados."
              : "Este producto se cobra a precio completo a todos."}
      </p>
    </div>
  );
}
