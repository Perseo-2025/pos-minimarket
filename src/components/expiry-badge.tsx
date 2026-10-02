import { Badge } from "@/components/ui/badge";
import { type ExpiryInfo, expiryInfo } from "@/domain/services/expiry";
import { cn } from "@/lib/utils";

// "2026-10-05" -> "05/10/2026" (how dates are printed on Peruvian packages).
export function formatExpiry(expiresAt: string) {
  const [year, month, day] = expiresAt.split("-");
  return `${day}/${month}/${year}`;
}

export function expiryLabel({ status, daysLeft }: ExpiryInfo) {
  if (status === "expired") {
    return daysLeft === -1 ? "Venció ayer" : `Vencido hace ${-daysLeft} días`;
  }
  if (daysLeft === 0) return "Vence hoy";
  if (daysLeft === 1) return "Vence mañana";
  return `Vence en ${daysLeft} días`;
}

const TONES = {
  expired: "border-destructive/30 bg-destructive/10 text-destructive",
  urgent: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-400",
  soon: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  ok: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
};

// Expired, a week or less, inside the warning window, or fine.
export function expiryTone(info: ExpiryInfo): keyof typeof TONES {
  if (info.status === "expired") return "expired";
  if (info.status === "soon") return info.daysLeft <= 7 ? "urgent" : "soon";
  return "ok";
}

export function ExpiryBadge({
  expiresAt,
  todayKey,
  warningDays,
  className,
}: {
  expiresAt: string;
  todayKey: string;
  warningDays: number;
  className?: string;
}) {
  const info = expiryInfo(expiresAt, todayKey, warningDays);
  return (
    <Badge variant="outline" className={cn(TONES[expiryTone(info)], className)}>
      {info.status === "ok" ? formatExpiry(expiresAt) : expiryLabel(info)}
    </Badge>
  );
}
