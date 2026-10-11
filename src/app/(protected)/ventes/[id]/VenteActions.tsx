"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Send, CheckCircle, XCircle, Clock, MessageSquare, X, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/format";

interface Demande {
  id: string; type: string; motif: string; statut: string;
  reponse?: string | null; createdAt: string;
  demandeur: { nom: string; prenom: string };
}

interface Props {
  venteId:          string;
  numero?:          string;
  total?:           number;
  montantPaye?:     number;
  totalEncaisseNet?: number;
  modePaiement?:    string;
  statut:           string;
  canAnnuler:       boolean; // SUPER_ADMIN
  isManager:        boolean;
  demandes:         Demande[];
}

const TYPE_LABELS: Record<string, string> = {
  ANNULATION: "Annulation", REMBOURSEMENT: "Remboursement", MODIFICATION: "Modification",
};

export function VenteActions({
  venteId,
  numero,
  total = 0,
  montantPaye = 0,
  totalEncaisseNet = 0,
  modePaiement,
  statut,
  canAnnuler,
  isManager,
  demandes,
}: Props) {
  const router = useRouter();
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState({ type: "ANNULATION", motif: "" });
  const [reponses, setReponses] = useState<Record<string, string>>({});

  // Modale d'annulation (Option 2)
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [rembourserAcompteChoice, setRembourserAcompteChoice] = useState<boolean>(true);

  if (statut !== "COMPLETEE") return null;

  // ── SUPER_ADMIN : Confirmation d'annulation avec gestion d'acompte ───────
  async function handleConfirmAnnulation() {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/ventes/${venteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          statut: "ANNULEE",
          rembourserAcompte: totalEncaisseNet > 0 ? rembourserAcompteChoice : false,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Erreur serveur");
      setShowCancelModal(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  async function handleApprobation(demandeId: string, statut: "APPROUVEE" | "REJETEE") {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/demandes/${demandeId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statut, reponse: reponses[demandeId] ?? "" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Erreur serveur");
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Erreur"); }
    finally { setLoading(false); }
  }

  // ── MANAGER : demande ──────────────────────────────────────────────────────
  async function handleDemande(e: React.FormEvent) {
    e.preventDefault();
    if (!form.motif.trim()) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/demandes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venteId, type: form.type, motif: form.motif }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Erreur serveur");
      setShowForm(false); setForm({ type: "ANNULATION", motif: "" });
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Erreur"); }
    finally { setLoading(false); }
  }

  const demandesEnAttente = demandes.filter(d => d.statut === "EN_ATTENTE");
  const hasDemandeEnAttente = demandesEnAttente.length > 0;

  return (
    <div className="space-y-4">
      {/* ── Demandes existantes (SUPER_ADMIN voit tout, MANAGER voit les siennes) ── */}
      {demandes.length > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold text-sm mb-4 flex items-center gap-2">
            <Send className="h-4 w-4 text-amber-500" />
            Demandes d&apos;approbation
          </h2>
          <div className="space-y-3">
            {demandes.map(d => (
              <div key={d.id} className={cn(
                "rounded-xl border p-4 text-sm space-y-2",
                d.statut === "EN_ATTENTE"  && "border-amber-200 bg-amber-50 dark:bg-amber-900/10",
                d.statut === "APPROUVEE"   && "border-emerald-200 bg-emerald-50 dark:bg-emerald-900/10",
                d.statut === "REJETEE"     && "border-red-200 bg-red-50 dark:bg-red-900/10",
              )}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="font-semibold">{TYPE_LABELS[d.type]} demandée</span>
                  <span className={cn("status-badge",
                    d.statut === "EN_ATTENTE" ? "status-badge-warning" :
                    d.statut === "APPROUVEE"  ? "status-badge-success" : "status-badge-danger"
                  )}>
                    {d.statut === "EN_ATTENTE" && <Clock className="h-3 w-3 inline mr-1" />}
                    {d.statut}
                  </span>
                </div>
                <p className="text-muted-foreground">
                  Par {d.demandeur.prenom} {d.demandeur.nom} · {new Date(d.createdAt).toLocaleDateString("fr-FR")}
                </p>
                <p className="italic">&quot;{d.motif}&quot;</p>
                {d.reponse && (
                  <p className="text-muted-foreground text-xs flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" /> Réponse : {d.reponse}
                  </p>
                )}

                {/* Boutons d'approbation pour SUPER_ADMIN */}
                {canAnnuler && d.statut === "EN_ATTENTE" && (
                  <div className="pt-2 space-y-2">
                    <textarea
                      value={reponses[d.id] ?? ""}
                      onChange={e => setReponses(r => ({ ...r, [d.id]: e.target.value }))}
                      placeholder="Réponse optionnelle..."
                      rows={2}
                      className="w-full rounded-lg border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprobation(d.id, "APPROUVEE")}
                        disabled={loading}
                        className="flex-1 h-9 rounded-lg bg-emerald-600 text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                      >
                        <CheckCircle className="h-4 w-4" /> Approuver
                      </button>
                      <button
                        onClick={() => handleApprobation(d.id, "REJETEE")}
                        disabled={loading}
                        className="flex-1 h-9 rounded-lg bg-red-600 text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        <XCircle className="h-4 w-4" /> Rejeter
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>
      )}

      {/* ── Zone SUPER_ADMIN : actions directes ── */}
      {canAnnuler && (
        <div className="card p-5 border-destructive/20">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" /> Zone danger
          </h2>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => setShowCancelModal(true)}
              disabled={loading}
              className="btn-danger text-sm disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Annuler la vente
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Restitue le stock et ajuste la comptabilité selon le montant réellement encaissé.
          </p>
        </div>
      )}

      {/* ── Modale de confirmation d'annulation (Option 2) ── */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b bg-destructive/5">
              <div className="flex items-center gap-2.5 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                <h3 className="font-bold text-base text-foreground">
                  Annuler la vente {numero ? <span className="font-mono text-destructive">{numero}</span> : ""}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                disabled={loading}
                className="p-1 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Contenu */}
            <div className="p-6 space-y-4 overflow-y-auto">
              {/* Récapitulatif financier */}
              <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-muted/50 border text-center text-xs">
                <div>
                  <span className="text-muted-foreground block mb-0.5">Total facture</span>
                  <span className="font-bold text-sm text-foreground">{formatCurrency(total)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-0.5">Déjà encaissé</span>
                  <span className={cn("font-bold text-sm", totalEncaisseNet > 0 ? "text-emerald-600" : "text-muted-foreground")}>
                    {formatCurrency(totalEncaisseNet)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-0.5">Non perçu (impayé)</span>
                  <span className="font-bold text-sm text-amber-600">
                    {formatCurrency(Math.max(0, total - totalEncaisseNet))}
                  </span>
                </div>
              </div>

              {/* Cas A : 0 XAF encaissé */}
              {totalEncaisseNet === 0 ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold text-sm">
                    <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>Protection de votre Chiffre d&apos;Affaires</span>
                  </div>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 leading-relaxed">
                    Cette facture était en paiement différé et aucun montant n&apos;a été perçu (0 XAF encaissé).
                    Par conséquent, <strong>aucun débit ne sera imputé à votre CA (0 XAF déduit)</strong>.
                    Le stock d&apos;articles sera automatiquement restitué à l&apos;inventaire.
                  </p>
                </div>
              ) : (
                /* Cas B : Acompte ou totalité encaissé -> Choix interactif */
                <div className="space-y-3">
                  <p className="text-xs font-medium text-foreground">
                    Un montant de <strong className="text-emerald-600 font-bold">{formatCurrency(totalEncaisseNet)}</strong> a été encaissé pour cette facture. Que souhaitez-vous faire ?
                  </p>

                  <div className="space-y-2.5">
                    {/* Option 1 : Rembourser */}
                    <label
                      onClick={() => setRembourserAcompteChoice(true)}
                      className={cn(
                        "flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all",
                        rembourserAcompteChoice
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:bg-muted/50"
                      )}
                    >
                      <input
                        type="radio"
                        name="choixAcompte"
                        checked={rembourserAcompteChoice}
                        onChange={() => setRembourserAcompteChoice(true)}
                        className="mt-1"
                      />
                      <div className="text-xs space-y-1">
                        <p className="font-semibold text-foreground">
                          Rembourser l&apos;acompte au client ({formatCurrency(totalEncaisseNet)})
                        </p>
                        <p className="text-muted-foreground leading-relaxed">
                          L&apos;argent est restitué au client en caisse. Votre CA sera ajusté de <strong>-{formatCurrency(totalEncaisseNet)}</strong> (opération nette à 0). Les {formatCurrency(Math.max(0, total - totalEncaisseNet))} impayés ne seront PAS déduits de votre CA.
                        </p>
                      </div>
                    </label>

                    {/* Option 2 : Conserver */}
                    <label
                      onClick={() => setRembourserAcompteChoice(false)}
                      className={cn(
                        "flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all",
                        !rembourserAcompteChoice
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:bg-muted/50"
                      )}
                    >
                      <input
                        type="radio"
                        name="choixAcompte"
                        checked={!rembourserAcompteChoice}
                        onChange={() => setRembourserAcompteChoice(false)}
                        className="mt-1"
                      />
                      <div className="text-xs space-y-1">
                        <p className="font-semibold text-foreground">
                          Conserver l&apos;acompte (Acompte non remboursé / frais)
                        </p>
                        <p className="text-muted-foreground leading-relaxed">
                          L&apos;argent reste acquis à votre entreprise. <strong>0 XAF ne sera débité de votre CA</strong>. Le stock sera réintégré.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t bg-muted/30">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                disabled={loading}
                className="px-4 py-2 rounded-xl text-sm font-medium border hover:bg-muted transition-colors disabled:opacity-50"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={handleConfirmAnnulation}
                disabled={loading}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Confirmer l&apos;annulation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Zone MANAGER : formulaire de demande ── */}
      {isManager && !hasDemandeEnAttente && (
        <div className="card p-5 border-amber-200 bg-amber-50/30 dark:bg-amber-900/5">
          <h2 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <Send className="h-4 w-4 text-amber-600" />
            Demander une modification au Super Admin
          </h2>
          <p className="text-xs text-muted-foreground mb-4">
            Toute modification de transaction doit être approuvée. Votre demande sera notifiée au Super Admin.
          </p>

          {!showForm ? (
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 active:scale-95 transition-all">
              <Send className="h-4 w-4" /> Soumettre une demande
            </button>
          ) : (
            <form onSubmit={handleDemande} className="space-y-3">
              <div>
                <label className="text-xs font-medium mb-1 block">Type d&apos;action demandée</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full h-9 rounded-lg border px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="ANNULATION">Annulation de la vente</option>
                  <option value="MODIFICATION">Modification de la vente</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Motif <span className="text-destructive">*</span></label>
                <textarea
                  value={form.motif}
                  onChange={e => setForm(f => ({ ...f, motif: e.target.value }))}
                  required rows={3} maxLength={500}
                  placeholder="Expliquez clairement la raison de votre demande..."
                  className="w-full rounded-lg border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="text-xs text-muted-foreground text-right mt-0.5">{form.motif.length}/500</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 h-9 rounded-lg border text-sm hover:bg-muted transition-colors">Annuler</button>
                <button type="submit" disabled={loading || !form.motif.trim()}
                  className="flex-1 h-9 rounded-lg bg-amber-500 text-white font-medium text-sm flex items-center justify-center gap-2 hover:bg-amber-600 disabled:opacity-50 transition-colors">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Envoyer la demande
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {isManager && hasDemandeEnAttente && (
        <div className="card p-4 border-amber-200 bg-amber-50/30 flex items-center gap-3">
          <Clock className="h-5 w-5 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-700">
            Une demande est en attente d&apos;approbation pour cette vente.
          </p>
        </div>
      )}
    </div>
  );
}
