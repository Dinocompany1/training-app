// utils/weekRange.ts
export const getWeekRange = (date: Date = new Date()) => {
  const base = new Date(date);
  const day = base.getDay(); // 0–6, sön=0
  const diff = (day + 6) % 7; // hur många dagar sedan måndag
  const start = new Date(base);
  start.setDate(base.getDate() - diff);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

export const isDateInRange = (isoDate: string, start: Date, end: Date) => {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return false;
  return d >= start && d <= end;
};
