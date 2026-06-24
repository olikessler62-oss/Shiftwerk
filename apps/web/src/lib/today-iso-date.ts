export const getTodayIsoDate = (): string =>
  new Date().toISOString().split("T")[0];
