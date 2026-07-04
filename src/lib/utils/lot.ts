// Référence de lot lisible : LOT-AAAAMMJJ-XXXX
export function genLotRef(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `LOT-${ymd}-${rand}`;
}
