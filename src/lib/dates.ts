const TZ = 'Europe/London';

const dateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

const timeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
});

/** Local date in Europe/London as 'YYYY-MM-DD'. */
export function localDate(ts: number = Date.now()): string {
  return dateFmt.format(new Date(ts));
}

/** Minutes since local midnight in Europe/London. */
export function localMinutes(ts: number = Date.now()): number {
  const [h, m] = timeFmt.format(new Date(ts)).split(':').map(Number);
  return h * 60 + m;
}

/** Add whole days to a 'YYYY-MM-DD' string (calendar arithmetic, DST-safe). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** Whole calendar days between two 'YYYY-MM-DD' strings (b - a). */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}
