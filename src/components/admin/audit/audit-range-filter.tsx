"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function shift(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function AuditRangeFilter({
  from,
  to,
  today,
  basePath = "/admin/audit",
  query,
}: {
  from: string;
  to: string;
  today: string;
  // The report page this filter belongs to.
  basePath?: string;
  // Other params to keep, e.g. "vista=rango&persona=3".
  query?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function go(nextFrom: string, nextTo: string) {
    const extra = query ? `${query}&` : "";
    startTransition(() => router.push(`${basePath}?${extra}from=${nextFrom}&to=${nextTo}`));
  }

  const presets = [
    { label: "Hoy", from: today, to: today },
    { label: "7 días", from: shift(today, -6), to: today },
    { label: "Este mes", from: `${today.slice(0, 7)}-01`, to: today },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2" aria-busy={isPending}>
      {presets.map((preset) => (
        <Button
          key={preset.label}
          size="sm"
          variant={preset.from === from && preset.to === to ? "secondary" : "outline"}
          onClick={() => go(preset.from, preset.to)}
        >
          {preset.label}
        </Button>
      ))}
      <Input
        type="date"
        aria-label="Desde"
        value={from}
        max={to}
        onChange={(e) => e.target.value && go(e.target.value, to)}
        className="w-38"
      />
      <span className="text-sm text-muted-foreground">a</span>
      <Input
        type="date"
        aria-label="Hasta"
        value={to}
        min={from}
        max={today}
        onChange={(e) => e.target.value && go(from, e.target.value)}
        className="w-38"
      />
    </div>
  );
}
