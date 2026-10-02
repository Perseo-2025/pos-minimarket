"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addDays } from "@/domain/services/attendance";

function useGo() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return {
    isPending,
    go: (href: string) => startTransition(() => router.push(href)),
  };
}

function shiftMonth(month: string, delta: number) {
  const date = new Date(`${month}-15T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + delta);
  return date.toISOString().slice(0, 7);
}

// ‹ 05/10/2026 › — one day of the "Por día" view.
export function DayPicker({ value, today }: { value: string; today: string }) {
  const { go, isPending } = useGo();
  const to = (date: string) => go(`/admin/asistencia?vista=dia&fecha=${date}`);
  return (
    <div className="flex items-center gap-2" aria-busy={isPending}>
      <Button size="icon" variant="outline" aria-label="Día anterior" onClick={() => to(addDays(value, -1))}>
        <ChevronLeftIcon />
      </Button>
      <Input
        type="date"
        aria-label="Fecha"
        value={value}
        max={today}
        onChange={(e) => e.target.value && to(e.target.value)}
        className="w-40"
      />
      <Button
        size="icon"
        variant="outline"
        aria-label="Día siguiente"
        disabled={value >= today}
        onClick={() => to(addDays(value, 1))}
      >
        <ChevronRightIcon />
      </Button>
      {value !== today && (
        <Button size="sm" variant="ghost" onClick={() => to(today)}>
          Hoy
        </Button>
      )}
    </div>
  );
}

// ‹ octubre 2026 › — for the month views (all staff, or one person).
export function MonthPicker({
  value,
  current,
  basePath,
}: {
  value: string;
  current: string;
  // e.g. "/admin/asistencia?vista=mes" — the month is appended.
  basePath: string;
}) {
  const { go, isPending } = useGo();
  const separator = basePath.includes("?") ? "&" : "?";
  const to = (month: string) => go(`${basePath}${separator}mes=${month}`);
  return (
    <div className="flex items-center gap-2" aria-busy={isPending}>
      <Button size="icon" variant="outline" aria-label="Mes anterior" onClick={() => to(shiftMonth(value, -1))}>
        <ChevronLeftIcon />
      </Button>
      <Input
        type="month"
        aria-label="Mes"
        value={value}
        max={current}
        onChange={(e) => e.target.value && to(e.target.value)}
        className="w-44"
      />
      <Button
        size="icon"
        variant="outline"
        aria-label="Mes siguiente"
        disabled={value >= current}
        onClick={() => to(shiftMonth(value, 1))}
      >
        <ChevronRightIcon />
      </Button>
    </div>
  );
}

// Everyone, or one person, for the hours report.
export function PersonFilter({
  people,
  value,
  from,
  to,
}: {
  people: { id: number; name: string }[];
  value: number | undefined;
  from: string;
  to: string;
}) {
  const { go } = useGo();
  const items = [{ value: "all", label: "Todo el personal" }].concat(
    people.map((p) => ({ value: String(p.id), label: p.name })),
  );
  return (
    <Select
      items={items}
      value={value ? String(value) : "all"}
      onValueChange={(next) => {
        const persona = next && next !== "all" ? `&persona=${next}` : "";
        go(`/admin/asistencia?vista=rango&from=${from}&to=${to}${persona}`);
      }}
    >
      <SelectTrigger className="w-56" aria-label="Persona">
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
