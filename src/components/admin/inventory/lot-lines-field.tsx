"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type LotLine = { key: string; expiresAt: string; quantity: string };

export function newLotLine(expiresAt = ""): LotLine {
  return { key: crypto.randomUUID(), expiresAt, quantity: "" };
}

export function lotLinesTotal(lines: LotLine[]) {
  return lines.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);
}

// Counted units grouped by the expiry date printed on the package: one line
// per date found on the shelf ("12 that expire on 05/10, 36 on 20/12").
export function LotLinesField({
  lines,
  onChange,
}: {
  lines: LotLine[];
  onChange: (lines: LotLine[]) => void;
}) {
  function update(key: string, patch: Partial<LotLine>) {
    onChange(lines.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[6rem_1fr_2rem] gap-2 text-xs text-muted-foreground">
        <span>Cantidad</span>
        <span>Vence el</span>
      </div>
      {lines.map((line, index) => (
        <div key={line.key} className="grid grid-cols-[6rem_1fr_2rem] gap-2">
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            aria-label={`Cantidad del lote ${index + 1}`}
            value={line.quantity}
            onChange={(e) => update(line.key, { quantity: e.target.value })}
            required
            autoFocus={index === 0}
          />
          <Input
            type="date"
            aria-label={`Fecha de vencimiento del lote ${index + 1}`}
            value={line.expiresAt}
            onChange={(e) => update(line.key, { expiresAt: e.target.value })}
            required
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Quitar lote ${index + 1}`}
            disabled={lines.length === 1}
            onClick={() => onChange(lines.filter((l) => l.key !== line.key))}
          >
            <XIcon />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => onChange([...lines, newLotLine()])}
      >
        <PlusIcon data-icon="inline-start" />
        Otra fecha
      </Button>
      <p className="text-xs text-muted-foreground">
        Agrupa por la fecha impresa en el envase. Total contado:{" "}
        <strong className="text-foreground tabular-nums">
          {lotLinesTotal(lines)}
        </strong>
      </p>
    </div>
  );
}
