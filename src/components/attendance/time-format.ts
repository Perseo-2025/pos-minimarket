import { STORE_TIME_ZONE } from "@/domain/value-objects/store-time";

// Times are always shown in the store's zone, whatever the device says.
export const timeFormat = new Intl.DateTimeFormat("es-PE", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: STORE_TIME_ZONE,
});

export const longDayFormat = new Intl.DateTimeFormat("es-PE", {
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  timeZone: STORE_TIME_ZONE,
});

export const formatTime = (value: string | Date) => timeFormat.format(new Date(value));

// "2026-10-05" → "lunes 05/10" (noon UTC is the same date in Lima).
export const formatWorkDate = (dateKey: string) =>
  longDayFormat.format(new Date(`${dateKey}T17:00:00Z`));

// HH:MM of an instant in the store's zone.
export function storeHhmm(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: STORE_TIME_ZONE,
  }).format(value);
}
