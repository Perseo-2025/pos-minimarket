"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// With the ring reader paired, the phone hides its on-screen keyboard:
// quantities must be adjustable with big buttons alone. The field still
// takes typing when a keyboard is available.
export function QuantityStepper({
  id,
  value,
  onChange,
  min = 0,
  required,
  invalid,
  className,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  required?: boolean;
  invalid?: boolean;
  className?: string;
}) {
  const current = Number(value) || 0;
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button
        type="button"
        variant="outline"
        size="icon-lg"
        className="size-11 shrink-0"
        aria-label="Uno menos"
        disabled={current <= min}
        onClick={() => onChange(String(Math.max(min, current - 1)))}
      >
        <MinusIcon />
      </Button>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        step={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid}
        required={required}
        className="h-11 min-w-0 flex-1 text-center text-lg tabular-nums"
      />
      <Button
        type="button"
        variant="outline"
        size="icon-lg"
        className="size-11 shrink-0"
        aria-label="Uno más"
        onClick={() => onChange(String(current + 1))}
      >
        <PlusIcon />
      </Button>
    </div>
  );
}
