"use client";

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSANT VentesRecentes — 5 dernières ventes, mise à jour temps réel
// Nouvelles ventes ajoutées en haut avec animation flash
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";

type ModePaiement = "ESPECES" | "CARTE" | "VIREMENT" | "CHEQUE" | "MIXTE" | "CREDIT";

interface VenteRecente {
  id:           string;
  numero:       string;
  total:        number;
  modePaiement: ModePaiement;
  createdAt:    string; // ISO string
  client:       { nom: string; prenom: string | null } | null;
  vendeur:      { nom: string; prenom: string };
  isNew?:       boolean; // Flash quand arrivée par SSE
}

interface Props {
  ventes: VenteRecente[];
}

const MODE_ICONES: Record<ModePaiement, { label: string; classes: string }> = {
  ESPECES:  { label: "Espèces",  classes: "bg-green-50  text-green-700"  },
  CARTE:    { label: "Carte",    classes: "bg-blue-50   text-blue-700"   },
  VIREMENT: { label: "Virement", classes: "bg-purple-50 text-purple-700" },
  CHEQUE:   { label: "Chèque",   classes: "bg-gray-50   text-gray-600"   },
  MIXTE:    { label: "Mixte",    classes: "bg-orange-50 text-orange-700" },
  CREDIT:   { label: "Crédit",   classes: "bg-amber-50  text-amber-700"  },
};

function formatEur(n: number) {
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n) + " XAF";
}

function formatHeure(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function formatDateCourte(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();

  if (isToday) return `Aujourd'hui ${formatHeure(iso)}`;

  return new Intl.DateTimeFormat("fr-FR", {
    day:   "2-digit",
    month: "short",
    hour:  "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function VentesRecentes({ ventes }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="font-semibold text-gray-800">Ventes récentes</h2>
        <Link
          href="/ventes"
          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
        >
          Tout voir →
        </Link>
      </div>

      {ventes.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-gray-400">
          Aucune vente aujourd&apos;hui
        </div>
      ) : (
        <ul className="divide-y divide-gray-50">
          {ventes.map((vente) => {
            const modeInfo = MODE_ICONES[vente.modePaiement];
            const nomClient = vente.client
              ? vente.client.prenom
                ? `${vente.client.prenom} ${vente.client.nom}`
                : vente.client.nom
              : null;

            return (
              <li
                key={vente.id}
                className={`px-5 py-3.5 flex items-center gap-4 hover:bg-gray-50 transition-colors ${
                  vente.isNew ? "animate-pulse bg-indigo-50" : ""
                }`}
              >
                {/* Heure */}
                <div className="shrink-0 w-24 text-xs text-gray-400 tabular-nums">
                  {formatDateCourte(vente.createdAt)}
                </div>

                {/* Infos vente */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/ventes/${vente.id}`}
                      className="text-sm font-mono font-medium text-gray-800 hover:text-indigo-600"
                    >
                      {vente.numero}
                    </Link>
                    {nomClient && (
                      <span className="text-xs text-gray-400 truncate">· {nomClient}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Caisse : {vente.vendeur.prenom} {vente.vendeur.nom}
                  </p>
                </div>

                {/* Mode paiement */}
                <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${modeInfo.classes}`}>
                  {modeInfo.label}
                </span>

                {/* Montant */}
                <div className="shrink-0 text-right">
                  <span className="text-sm font-bold text-gray-900">{formatEur(vente.total)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
