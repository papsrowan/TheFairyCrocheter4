// Référence d'arrivage lisible : ARR-AAAAMMJJ-XXXX
export function genArrivageRef(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ARR-${ymd}-${rand}`;
}
