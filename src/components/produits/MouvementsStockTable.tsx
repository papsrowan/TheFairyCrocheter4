"use client";

interface MouvementStock {
  id:         string;
  type:       string;
  quantite:   number;
  stockAvant: number;
  stockApres: number;
  motif:      string | null;
  venteId:    string | null;
  createdAt:  string;
}

const TYPE_META: Record<string, { label: string; color: string; sign: string; bg: string }> = {
  ENTREE:          { label: "Entrée stock",    color: "text-emerald-700", bg: "bg-emerald-100", sign: "+" },
  SORTIE_VENTE:    { label: "Vente",           color: "text-blue-700",   bg: "bg-blue-100",    sign: "−" },
  SORTIE_MANUELLE: { label: "Sortie manuelle", color: "text-orange-700", bg: "bg-orange-100",  sign: "−" },
  CORRECTION:      { label: "Correction",      color: "text-purple-700", bg: "bg-purple-100",  sign: "±" },
  INVENTAIRE:      { label: "Inventaire",      color: "text-gray-700",   bg: "bg-gray-100",    sign: "=" },
};

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

export default function MouvementsStockTable({ mouvements }: { mouvements: MouvementStock[] }) {
  if (mouvements.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Aucun mouvement de stock enregistré
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-secondary text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <th className="px-4 py-3">#</th>
            <th className="px-4 py-3">Date & Heure</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3 text-right">Qté</th>
            <th className="px-4 py-3 text-right">Avant</th>
            <th className="px-4 py-3 text-right">→ Après</th>
            <th className="px-4 py-3">Motif / Référence</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {mouvements.map((m, idx) => {
            const meta  = TYPE_META[m.type] ?? { label: m.type, color: "text-gray-700", bg: "bg-gray-100", sign: "" };
            const delta = m.stockApres - m.stockAvant;
            return (
              <tr key={m.id} className="hover:bg-secondary/50 transition-colors">
                <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{idx + 1}</td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap font-mono text-xs">
                  {fmtDate(m.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${meta.bg} ${meta.color}`}>
                    {meta.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold">
                  <span className={delta >= 0 ? "text-emerald-600" : "text-red-600"}>
                    {meta.sign}{m.quantite}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-muted-foreground">{m.stockAvant}</td>
                <td className="px-4 py-3 text-right font-mono font-bold text-foreground">{m.stockApres}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs max-w-xs">
                  {m.motif ?? "—"}
                  {m.venteId && (
                    <a href={`/ventes/${m.venteId}`}
                      className="ml-2 text-primary hover:underline font-medium">
                      → Voir vente
                    </a>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-secondary/50 text-xs text-muted-foreground font-medium">
            <td colSpan={5} className="px-4 py-2">{mouvements.length} mouvement(s)</td>
            <td className="px-4 py-2 text-right font-bold text-foreground">
              {mouvements.at(-1)?.stockApres ?? 0} en stock
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
