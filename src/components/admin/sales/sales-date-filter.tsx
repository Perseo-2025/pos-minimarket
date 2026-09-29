"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SalesDateFilter({
  date,
  today,
}: {
  date: string;
  today: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function goTo(next: string) {
    startTransition(() => {
      router.push(next === today ? "/admin/sales" : `/admin/sales?date=${next}`);
    });
  }

  return (
    <div className="flex items-center gap-2" aria-busy={isPending}>
      <Input
        type="date"
        aria-label="Fecha de las ventas"
        value={date}
        max={today}
        onChange={(event) => event.target.value && goTo(event.target.value)}
        className="w-40"
      />
      <Button
        variant="outline"
        disabled={date === today || isPending}
        onClick={() => goTo(today)}
      >
        Hoy
      </Button>
    </div>
  );
}
