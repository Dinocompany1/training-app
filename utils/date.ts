export type AppLang = 'sv' | 'en';

const localeFor = (lang: AppLang) => (lang === 'en' ? 'en-US' : 'sv-SE');

export const todayISO = (): string => toISODate(new Date());

export const toISODate = (date: Date): string => {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const parseISODate = (value?: string | null): Date | null => {
  if (!value) return null;
  const parts = value.split('-');
  if (parts.length !== 3) return null;
  const [year, month, day] = parts.map((p) => Number.parseInt(p, 10));
  if (!year || !month || !day) return null;
  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) return null;
  if (toISODate(parsed) !== value) return null;
  return parsed;
};

export const addDaysISO = (startISO: string, days: number): string => {
  const start = parseISODate(startISO) ?? new Date();
  const next = new Date(start);
  next.setDate(next.getDate() + days);
  return toISODate(next);
};

export const compareISODate = (a: string, b: string): number => {
  const parsedA = parseISODate(a);
  const parsedB = parseISODate(b);
  if (parsedA && parsedB) return parsedA.getTime() - parsedB.getTime();
  return a.localeCompare(b);
};

export const formatDateShort = (isoDate: string, lang: AppLang): string => {
  const parsed = parseISODate(isoDate);
  if (!parsed) return isoDate;
  return new Intl.DateTimeFormat(localeFor(lang), {
    day: '2-digit',
    month: 'short',
  }).format(parsed);
};

export const formatDateLong = (isoDate: string, lang: AppLang): string => {
  const parsed = parseISODate(isoDate);
  if (!parsed) return isoDate;
  return new Intl.DateTimeFormat(localeFor(lang), {
    day: 'numeric',
    month: 'long',
  }).format(parsed);
};
