"use client";

import { DeleteIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { PIN_LENGTH } from "@/domain/entities/worker";
import { cn } from "@/lib/utils";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

// Big, touch-first numeric keypad for the *worker* to type their PIN on the
// cashier's screen. Digits are masked; the physical keyboard also works.
export function PinPad({
  value,
  onChange,
  onComplete,
  disabled = false,
  error,
  status,
}: {
  value: string;
  onChange: (value: string) => void;
  onComplete: (pin: string) => void;
  disabled?: boolean;
  error?: string | null;
  // Neutral progress message, e.g. "Verificando…".
  status?: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  function press(digit: string) {
    if (disabled || value.length >= PIN_LENGTH) return;
    const next = value + digit;
    onChange(next);
    if (next.length === PIN_LENGTH) onComplete(next);
  }

  function erase() {
    if (!disabled) onChange(value.slice(0, -1));
  }

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      className="flex flex-col items-center gap-5 outline-none"
      onKeyDown={(event) => {
        if (/^\d$/.test(event.key)) {
          event.preventDefault();
          press(event.key);
        } else if (event.key === "Backspace") {
          event.preventDefault();
          erase();
        }
      }}
    >
      <div
        className="flex gap-3"
        role="status"
        aria-label={`${value.length} de ${PIN_LENGTH} números ingresados`}
      >
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span
            key={i}
            aria-hidden
            className={cn(
              "size-4 rounded-full border-2 transition-colors",
              i < value.length
                ? "border-primary bg-primary"
                : "border-muted-foreground/40",
              error && "border-destructive",
              error && i < value.length && "bg-destructive",
            )}
          />
        ))}
      </div>

      <p
        className={cn(
          "min-h-5 text-center text-sm font-medium",
          error && !status ? "text-destructive" : "text-muted-foreground",
        )}
        aria-live="polite"
      >
        {status ?? error ?? `Ingresa los ${PIN_LENGTH} números`}
      </p>

      <div className="grid w-full max-w-xs grid-cols-3 gap-2">
        {KEYS.map((key) => (
          <PadButton key={key} onClick={() => press(key)} disabled={disabled}>
            {key}
          </PadButton>
        ))}
        <span />
        <PadButton onClick={() => press("0")} disabled={disabled}>
          0
        </PadButton>
        <PadButton
          onClick={erase}
          disabled={disabled || value.length === 0}
          aria-label="Borrar último número"
          className="text-muted-foreground"
        >
          <DeleteIcon className="size-6" />
        </PadButton>
      </div>
    </div>
  );
}

function PadButton({
  className,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-14 items-center justify-center rounded-xl border bg-card text-2xl font-semibold tabular-nums shadow-xs transition-colors select-none hover:bg-muted active:translate-y-px active:bg-muted disabled:pointer-events-none disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}
