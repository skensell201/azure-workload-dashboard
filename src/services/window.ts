import { DateWindow } from '../models/types';

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Monday of the current week (UTC) through Sunday of the next week — 14 days inclusive. */
export function defaultWindow(today: Date): DateWindow {
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const shiftToMonday = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - shiftToMonday);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 13);
  return { start: toIsoDate(start), end: toIsoDate(end) };
}
