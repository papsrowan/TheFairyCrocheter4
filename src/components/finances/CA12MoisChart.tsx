// Diagramme du chiffre d'affaires sur les 12 derniers mois (barres, sans JS).
// Composant présentiel — reçoit la série déjà calculée côté serveur.

import { BarChart3 } from "lucide-react";
import { formatCurrency } from "@/lib/utils/format";

export interface PointMois {
  mois: string; // "AAAA-MM"
  ca: number;
}

export function CA12MoisChart({ data, titre = "Chiffre d'affaires — 12 derniers mois" }: { data: PointMois[]; titre?: string }) {
  const max = Math.max(...data.map((d) => d.ca), 1);
  const totalAnnee = data.reduce((s, d) => s + d.ca, 0);

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-sm">{titre}</h2>
        </div>
        <span className="text-xs text-muted-foreground">
          Total : <span className="font-bold text-foreground">{formatCurrency(totalAnnee)}</span>
        </span>
      </div>

      <div className="flex items-end gap-1.5 h-40">
        {data.map((d) => {
          const pct = (d.ca / max) * 100;
          const label = new Date(d.mois + "-01T12:00:00").toLocaleDateString("fr-FR", { month: "short" });
          return (
            <div key={d.mois} className="flex-1 flex flex-col items-center gap-1 group min-w-0">
              <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                {d.ca > 0 ? formatCurrency(d.ca) : ""}
              </span>
              <div className="w-full rounded-t-sm bg-primary/15 relative" style={{ height: "120px" }}>
                <div
                  className="absolute bottom-0 w-full rounded-t-sm bg-primary transition-all"
                  style={{ height: `${pct}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground capitalize truncate w-full text-center">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
