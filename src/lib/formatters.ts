export const brl = (n: number | string | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n ?? 0));

export const num = (n: number | string | null | undefined, digits = 2) =>
  new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(n ?? 0));

export const dateBR = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("pt-BR");
};

export const dateTimeBR = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("pt-BR");
};

export const daysUntil = (d: string | Date | null | undefined): number | null => {
  if (!d) return null;
  const date = typeof d === "string" ? new Date(d) : d;
  const now = new Date();
  return Math.floor((date.getTime() - now.getTime()) / 86400000);
};
