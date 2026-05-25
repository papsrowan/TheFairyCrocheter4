// ─────────────────────────────────────────────────────────────────────────────
// UTILITAIRES DE FORMATAGE — Monnaie, dates, numéros
// Localisation FR : Euro, format français
// ─────────────────────────────────────────────────────────────────────────────

import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

/** Formate un montant en XAF (ex: 1 500 XAF) */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + " XAF";
}

/** Formate une date en français (ex: 16 avril 2024) */
export function formatDate(date: Date | string): string {
  return format(new Date(date), "d MMMM yyyy", { locale: fr });
}

/** Formate une date + heure (ex: 16 avr. 2024 à 14h30) */
export function formatDateTime(date: Date | string): string {
  return format(new Date(date), "d MMM yyyy 'à' HH'h'mm", { locale: fr });
}

/** Formate une date courte (ex: 16/04/2024) */
export function formatDateShort(date: Date | string): string {
  return format(new Date(date), "dd/MM/yyyy");
}

/** Temps relatif en français (ex: "il y a 5 minutes") */
export function timeAgo(date: Date | string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: fr });
}

/** Formate un pourcentage (ex: 20,5 %) */
export function formatPercent(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value / 100);
}

/** Génère un numéro de vente unique (ex: VTE-2024-00001) */
export function generateNumeroVente(lastNumber: number): string {
  const year = new Date().getFullYear();
  const padded = String(lastNumber + 1).padStart(5, "0");
  return `VTE-${year}-${padded}`;
}

/** Tronque un texte long */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}…`;
}
