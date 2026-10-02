const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// ?from=YYYY-MM-DD&to=YYYY-MM-DD for the admin reports. Invalid or future
// dates fall back to the last 7 days ending today.
export function parseDateRange(
  params: { from?: unknown; to?: unknown },
  today: string,
) {
  const valid = (value: unknown) =>
    typeof value === "string" && DATE_PATTERN.test(value) && value <= today;
  const to = valid(params.to) ? (params.to as string) : today;
  const defaultFrom = new Date(`${today}T12:00:00Z`);
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 6);
  const from =
    valid(params.from) && (params.from as string) <= to
      ? (params.from as string)
      : defaultFrom.toISOString().slice(0, 10);
  return { from: from > to ? to : from, to };
}
