"use client";

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSANT DashboardStats — 4 cartes de métriques clés
// Se met à jour en temps réel via les props poussées par DashboardClient
// ─────────────────────────────────────────────────────────────────────────────

interface StatCardProps {
  label:      string;
  value:      string;
  sub?:       string;
  evolution?: number | null;  // % vs référence précédente
  highlight?: "success" | "danger" | "warning" | "neutral";
  pulse?:     boolean;        // Animation flash quand mise à jour SSE
}

function StatCard({ label, value, sub, evolution, highlight = "neutral", pulse }: StatCardProps) {
  const highlightClasses: Record<string, string> = {
    success: "border-green-200  bg-green-50",
    danger:  "border-red-200    bg-red-50",
    warning: "border-amber-200  bg-amber-50",
    neutral: "border-gray-200   bg-white",
  };

  const valueClasses: Record<string, string> = {
    success: "text-green-700",
    danger:  "text-red-700",
    warning: "text-amber-700",
    neutral: "text-gray-900",
  };

  return (
    <div
      className={`rounded-xl border p-5 transition-all duration-300 ${highlightClasses[highlight]} ${
        pulse ? "ring-2 ring-indigo-400 ring-offset-1" : ""
      }`}
    >
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>

      <p className={`text-3xl font-bold mt-2 ${valueClasses[highlight]}`}>{value}</p>

      <div className="mt-1.5 flex items-center gap-2">
        {evolution != null && (
          <span
            className={`text-xs font-medium ${
              evolution > 0 ? "text-green-600" : evolution < 0 ? "text-red-500" : "text-gray-400"
            }`}
          >
            {evolution > 0 ? "▲" : evolution < 0 ? "▼" : "="}
            {" "}
            {Math.abs(evolution).toFixed(1)} % vs hier
          </span>
        )}
        {sub && <span className="text-xs text-gray-400">{sub}</span>}
      </div>
    </div>
  );
}

interface Props {
  ventesCount:      number;
  ventesTotal:      number;
  evolutionCA:      number | null;
  alertesCount:     number;
  clientsActifs:    number;
  showFinances:     boolean;
  pulseVentes:      boolean;
  pulseAlertes:     boolean;
}

function formatEur(n: number) {
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n) + " XAF";
}

export function DashboardStats({
  ventesCount,
  ventesTotal,
  evolutionCA,
  alertesCount,
  clientsActifs,
  showFinances,
  pulseVentes,
  pulseAlertes,
}: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <StatCard
        label="Ventes aujourd'hui"
        value={String(ventesCount)}
        sub={`${ventesCount === 1 ? "transaction" : "transactions"}`}
        highlight="neutral"
        pulse={pulseVentes}
      />

      {showFinances && (
        <StatCard
          label="CA aujourd'hui"
          value={formatEur(ventesTotal)}
          evolution={evolutionCA}
          highlight={
            evolutionCA == null
              ? "neutral"
              : evolutionCA >= 0
              ? "success"
              : "warning"
          }
          pulse={pulseVentes}
        />
      )}

      <StatCard
        label="Alertes stock"
        value={String(alertesCount)}
        sub={alertesCount === 0 ? "Tous les stocks OK" : `produit${alertesCount > 1 ? "s" : ""} sous le seuil`}
        highlight={alertesCount === 0 ? "success" : alertesCount > 5 ? "danger" : "warning"}
        pulse={pulseAlertes}
      />

      <StatCard
        label="Clients actifs"
        value={String(clientsActifs)}
        sub="ce mois-ci"
        highlight="neutral"
      />
    </div>
  );
}
