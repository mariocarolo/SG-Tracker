// Date helpers — all UTC-based to keep ISO dates stable across time zones.
export const DAY = 86400000;

export const iso = (d: Date): string => d.toISOString().slice(0, 10);

export const parse = (s: string): Date => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

export const addMonths = (d: Date, n: number): Date => {
  const x = new Date(d);
  x.setUTCMonth(x.getUTCMonth() + n);
  return x;
};

export const addDays = (d: Date, n: number): Date => new Date(d.getTime() + n * DAY);

export const todayISO = (): string => iso(new Date());

export const fmt = (s?: string): string =>
  s ? parse(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "—";

export const fmtShort = (s?: string): string =>
  s ? parse(s).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "—";

export const fmtDT = (ts: string): string => {
  try {
    return new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return ts;
  }
};

export const dayGap = (aISO: string, bISO: string): number => Math.round((parse(bISO).getTime() - parse(aISO).getTime()) / DAY);
export const dayDiff = dayGap;

export const uid = (): string => Math.random().toString(36).slice(2, 10);
