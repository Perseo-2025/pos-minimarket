// The store operates in Peru (UTC-5, no DST). Day/month boundaries are
// computed in that zone explicitly so limits and reports don't shift when the
// server runs in UTC.
export const STORE_TIME_ZONE = "America/Lima";
export const STORE_UTC_OFFSET = "-05:00";

// YYYY-MM-DD of the given instant in the store's zone.
export function storeDateKey(date: Date) {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: STORE_TIME_ZONE }).format(
    date,
  );
}

export function storeDayStart(date: Date) {
  return new Date(`${storeDateKey(date)}T00:00:00.000${STORE_UTC_OFFSET}`);
}

export function storeMonthStart(date: Date) {
  return new Date(
    `${storeDateKey(date).slice(0, 7)}-01T00:00:00.000${STORE_UTC_OFFSET}`,
  );
}

export function storeDayRange(dateKey: string) {
  return {
    from: new Date(`${dateKey}T00:00:00.000${STORE_UTC_OFFSET}`),
    to: new Date(`${dateKey}T23:59:59.999${STORE_UTC_OFFSET}`),
  };
}
