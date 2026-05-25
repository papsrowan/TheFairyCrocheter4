"use client";

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSANT ClientDetailClient — Sidebar fiche client
// Infos de contact + statut RGPD + actions (anonymiser, supprimer)
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  clientId:         string;
  nomClient:        string;
  email:            string | null;
  telephone:        string | null;
  consentementRGPD: boolean;
  consentementDate: string | null;
  estAnonyme:       boolean;
  anonymiseLe:      string | null;
  canRGPD:          boolean;
  canDelete:        boolean;
  nbVentes:         number;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(d));
}

export function ClientDetailClient({
  clientId,
  nomClient,
  email,
  telephone,
  consentementRGPD,
  consentementDate,
  estAnonyme,
  anonymiseLe,
  canRGPD,
  canDelete,
  nbVentes,
}: Props) {
  const router = useRouter();

  const [loadingRGPD,   setLoadingRGPD]   = useState(false);
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [motifRGPD,     setMotifRGPD]     = useState("");
  const [confirmRGPD,   setConfirmRGPD]   = useState(false);

  async function handleAnonymiser() {
    if (!confirm(
      `Anonymiser définitivement ${nomClient} ?\n\nToutes les données personnelles seront effacées. L'historique financier sera conservé.\n\nCette action est IRRÉVERSIBLE.`
    )) return;

    setLoadingRGPD(true);
    setError(null);

    try {
      const res = await fetch(`/api/clients/${clientId}/anonymize`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ motif: motifRGPD || "Droit à l'oubli RGPD" }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Erreur lors de l'anonymisation");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoadingRGPD(false);
      setConfirmRGPD(false);
    }
  }

  async function handleSupprimer() {
    if (!confirm(
      `Supprimer définitivement ${nomClient} ?\n\nCette action est irréversible.`
    )) return;

    setLoadingDelete(true);
    setError(null);

    try {
      const res = await fetch(`/api/clients/${clientId}`, { method: "DELETE" });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Erreur lors de la suppression");
      }

      router.push("/clients");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      setLoadingDelete(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Informations de contact ──────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Contact</h3>

        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <span className="text-gray-400 w-4 mt-0.5">@</span>
            <span className="text-gray-800 break-all">{email ?? <span className="text-gray-400">—</span>}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-gray-400 w-4 mt-0.5">☎</span>
            <span className="text-gray-800">{telephone ?? <span className="text-gray-400">—</span>}</span>
          </div>
        </div>
      </div>

      {/* ── Statut RGPD ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">RGPD</h3>

        {estAnonyme ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="inline-block w-2 h-2 rounded-full bg-gray-400" />
            Anonymisé le {formatDate(anonymiseLe)}
          </div>
        ) : (
          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  consentementRGPD ? "bg-green-500" : "bg-red-400"
                }`}
              />
              <span className={consentementRGPD ? "text-green-700" : "text-red-600"}>
                {consentementRGPD ? "Consentement donné" : "Pas de consentement"}
              </span>
            </div>
            {consentementRGPD && consentementDate && (
              <p className="text-xs text-gray-400 ml-4">le {formatDate(consentementDate)}</p>
            )}
          </div>
        )}
      </div>

      {/* ── Actions ──────────────────────────────────────────────────── */}
      {(canRGPD || canDelete) && !estAnonyme && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Actions</h3>

          {/* Anonymisation RGPD */}
          {canRGPD && (
            <div className="space-y-2">
              {confirmRGPD ? (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500">
                    Motif (optionnel) :
                  </p>
                  <input
                    type="text"
                    value={motifRGPD}
                    onChange={(e) => setMotifRGPD(e.target.value)}
                    placeholder="Ex : demande client par email"
                    className="pos-input w-full text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleAnonymiser}
                      disabled={loadingRGPD}
                      className="flex-1 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
                    >
                      {loadingRGPD ? "Anonymisation..." : "Confirmer l'anonymisation"}
                    </button>
                    <button
                      onClick={() => setConfirmRGPD(false)}
                      className="px-3 py-2 text-gray-500 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmRGPD(true)}
                  className="w-full py-2 text-amber-700 border border-amber-200 bg-amber-50 rounded-lg text-sm font-medium hover:bg-amber-100 transition-colors"
                >
                  Droit à l&apos;oubli (RGPD)
                </button>
              )}
            </div>
          )}

          {/* Suppression définitive (si aucune vente) */}
          {canDelete && nbVentes === 0 && (
            <button
              onClick={handleSupprimer}
              disabled={loadingDelete}
              className="w-full py-2 text-red-700 border border-red-200 bg-red-50 rounded-lg text-sm font-medium hover:bg-red-100 disabled:opacity-50 transition-colors"
            >
              {loadingDelete ? "Suppression..." : "Supprimer le client"}
            </button>
          )}

          {canDelete && nbVentes > 0 && (
            <p className="text-xs text-gray-400">
              Suppression impossible : {nbVentes} vente(s) associée(s). Utilisez l&apos;anonymisation RGPD.
            </p>
          )}
        </div>
      )}

      {/* ── Erreur ───────────────────────────────────────────────────── */}
      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}
    </div>
  );
}
