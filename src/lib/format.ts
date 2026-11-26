export function euro(cents: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function timeAgo(iso: string): string {
  const date = new Date(iso);
  const seconds = Math.max(1, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "adesso";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min fa`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h fa`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} g fa`;
  return date.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
}

export const conditionLabels: Record<string, string> = {
  nuovo: "Nuovo con etichetta",
  come_nuovo: "Come nuovo",
  ottimo: "Ottimo",
  buono: "Buono",
  discreto: "Discreto",
};

export const offerStatusLabels: Record<string, string> = {
  pending: "In attesa",
  accepted: "Accettata",
  declined: "Rifiutata",
  expired: "Scaduta",
  withdrawn: "Ritirata",
};

export const orderStatusLabels: Record<string, string> = {
  pending: "In attesa",
  paid: "Pagato",
  shipped: "Spedito",
  delivered: "Consegnato",
  cancelled: "Annullato",
};

export const shipmentStatusLabels: Record<string, string> = {
  preparing: "In preparazione",
  shipped: "Spedito",
  in_transit: "In transito",
  delivered: "Consegnato",
};

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
