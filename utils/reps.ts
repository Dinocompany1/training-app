export const parseRepsValue = (input: string): number => {
  if (!input) return 0;
  const matches = input.match(/\d+/g);
  if (!matches || matches.length === 0) return 0;
  const values = matches
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value >= 0);
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
};

