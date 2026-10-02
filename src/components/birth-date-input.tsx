"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";

// "02101990" → "02/10/1990" while typing.
function mask(digits: string) {
  const d = digits.slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

// DD/MM/AAAA (as written in Peru) → YYYY-MM-DD, or null while incomplete or
// not a real date.
export function parseBirthDate(display: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display);
  if (!match) return null;
  const [, day, month, year] = match;
  const iso = `${year}-${month}-${day}`;
  const date = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso) {
    return null;
  }
  return iso;
}

// YYYY-MM-DD → DD/MM/AAAA.
export function formatBirthDate(iso: string | null) {
  if (!iso) return "";
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

// Typed with the number pad: a calendar picker is slow for birth dates
// (scrolling back decades), and cashiers already type DNIs this way.
export function BirthDateInput({
  id,
  defaultValue = null,
  onChange,
  autoFocus,
  className,
}: {
  id?: string;
  defaultValue?: string | null;
  // The ISO date, or null while it's incomplete/invalid.
  onChange: (value: string | null) => void;
  autoFocus?: boolean;
  className?: string;
}) {
  const [display, setDisplay] = useState(() => formatBirthDate(defaultValue));

  return (
    <Input
      id={id}
      inputMode="numeric"
      autoComplete="off"
      autoFocus={autoFocus}
      placeholder="DD/MM/AAAA"
      maxLength={10}
      value={display}
      onChange={(event) => {
        const next = mask(event.target.value.replace(/\D/g, ""));
        setDisplay(next);
        onChange(parseBirthDate(next));
      }}
      className={className}
    />
  );
}
