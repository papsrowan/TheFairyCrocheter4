"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { ProductSearch } from "@/components/ventes/ProductSearch";
import { CartSummary } from "@/components/ventes/CartSummary";
import { useCartStore } from "@/stores/cartStore";
import { formatCurrency } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import {
  User, UserPlus, X, Search, CheckCircle,
  FileText, Printer, ArrowLeft, Receipt, Loader2, ScanLine,
} from "lucide-react";

const CameraScanner = dynamic(
  () => import("@/components/ventes/CameraScanner").then((m) => m.CameraScanner),
  { ssr: false }
);

interface Client {
  id: string;
  nom: string;
  prenom?: string;
  telephone?: string;
  totalAchats: number;
}

// ── Modal création client inline ─────────────────────────────────────────────
function NouveauClientModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (client: Client) => void;
}) {
  const [form, setForm] = useState({ nom: "", prenom: "", telephone: "", email: "" });
  const [error, setError] = useState<string | null>(null);

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom: form.nom.trim(),
          prenom: form.prenom.trim() || undefined,
          telephone: form.telephone.trim() || undefined,
          email: form.email.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error ?? "Erreur serveur");
      return (json as { data: Client }).data;
    },
    onSuccess: (client) => {
      onCreated({ ...client, totalAchats: 0 });
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full sm:max-w-md bg-card rounded-t-2xl sm:rounded-xl shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-lg">Nouveau client</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2 mb-4">
            {error}
          </p>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Nom *</label>
            <input
              autoFocus
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
              className="mt-1 w-full h-9 rounded-md border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Dupont"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Prénom</label>
            <input
              value={form.prenom}
              onChange={(e) => setForm({ ...form, prenom: e.target.value })}
              className="mt-1 w-full h-9 rounded-md border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Marie"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Téléphone</label>
            <input
              value={form.telephone}
              onChange={(e) => setForm({ ...form, telephone: e.target.value })}
              className="mt-1 w-full h-9 rounded-md border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="+33 6 00 00 00 00"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="mt-1 w-full h-9 rounded-md border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="marie@example.com"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 h-10 rounded-lg border text-sm hover:bg-muted transition-colors">
            Annuler
          </button>
          <button
            onClick={() => { if (form.nom.trim()) mutate(); }}
            disabled={!form.nom.trim() || isPending}
            className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Créer & associer
          </button>
        </div>
      </div>
    </div>
  );
}

// ── CaisseView ────────────────────────────────────────────────────────────────
export function CaisseView() {
  const router = useRouter();
  const { setClient, clearClient, clientId, clientNom, items } = useCartStore();

  const [clientSearch, setClientSearch] = useState("");
  const [showClientSearch, setShowClientSearch] = useState(false);
  const [showNouveauClient, setShowNouveauClient] = useState(false);
  const [venteConfirmee, setVenteConfirmee] = useState<{ id: string; numero: string } | null>(null);
  const [mobileTab, setMobileTab] = useState<"produits" | "panier">("produits");
  const [showCamera, setShowCamera] = useState(false);

  const { data: clientsData } = useQuery({
    queryKey: ["clients", "search", clientSearch],
    queryFn: async () => {
      if (clientSearch.length < 2) return { data: [] };
      const res = await fetch(`/api/clients?search=${encodeURIComponent(clientSearch)}&pageSize=5`);
      if (!res.ok) return { data: [] };
      return res.json() as Promise<{ data: Client[] }>;
    },
    enabled: clientSearch.length >= 2,
    staleTime: 10_000,
  });

  const clients = clientsData?.data ?? [];

  const selectClient = useCallback((client: Client) => {
    setClient(client.id, `${client.prenom ?? ""} ${client.nom}`.trim());
    setShowClientSearch(false);
    setClientSearch("");
  }, [setClient]);

  const handleVenteCreee = useCallback((venteId: string, numero: string) => {
    setVenteConfirmee({ id: venteId, numero });
  }, []);

  // ── Écran de confirmation post-vente ─────────────────────────────────────
  if (venteConfirmee) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4">
        <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <CheckCircle className="h-10 w-10 text-green-600" />
        </div>

        <div className="text-center">
          <h2 className="text-2xl font-bold">Vente enregistrée !</h2>
          <p className="text-muted-foreground mt-1">
            Numéro : <span className="font-mono font-bold">{venteConfirmee.numero}</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-3 justify-center">
          <a
            href={`/documents/recu/${venteConfirmee.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Receipt className="h-4 w-4" />
            Aperçu reçu / Imprimer
          </a>
          <a
            href={`/api/documents/ticket/${venteConfirmee.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            <Printer className="h-4 w-4" />
            Ticket PDF
          </a>
          <a
            href={`/api/documents/facture/${venteConfirmee.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            <FileText className="h-4 w-4" />
            Facture PDF
          </a>
        </div>

        <div className="flex flex-wrap gap-3 justify-center">
          <button
            onClick={() => setVenteConfirmee(null)}
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            <UserPlus className="h-4 w-4" />
            Nouvelle vente
          </button>
          <button
            onClick={() => router.push(`/ventes/${venteConfirmee.id}`)}
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            Détails de la vente
          </button>
        </div>

        <button
          onClick={() => router.push("/ventes")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voir toutes les ventes
        </button>
      </div>
    );
  }

  return (
    <>
      {showCamera && (
        <CameraScanner onClose={() => { setShowCamera(false); setMobileTab("panier"); }} />
      )}

      {showNouveauClient && (
        <NouveauClientModal
          onClose={() => setShowNouveauClient(false)}
          onCreated={(client) => {
            selectClient(client);
            setShowNouveauClient(false);
          }}
        />
      )}

      <div className="flex flex-col h-[calc(100dvh-4rem)] lg:h-[calc(100vh-8rem)] -m-4 lg:-m-6">
        {/* Barre supérieure */}
        <div className="flex items-center justify-between px-4 lg:px-6 py-3 border-b bg-card shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-1.5 rounded hover:bg-muted transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h1 className="font-bold text-lg">Caisse enregistreuse</h1>
            {items.length > 0 && (
              <span className="text-xs bg-primary/10 text-primary rounded-full px-2.5 py-1 font-medium">
                {items.length} article{items.length > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Sélection client */}
          <div className="relative">
            {clientId ? (
              <div className="flex items-center gap-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-3 py-1.5">
                <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  {clientNom}
                </span>
                <button
                  onClick={clearClient}
                  className="text-blue-400 hover:text-blue-600 transition-colors ml-1"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowClientSearch(!showClientSearch)}
                className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm hover:bg-muted transition-colors"
              >
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Associer un client</span>
              </button>
            )}

            {showClientSearch && !clientId && (
              <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border bg-card shadow-xl z-50">
                <div className="p-3 border-b">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      autoFocus
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      placeholder="Rechercher un client..."
                      className="w-full h-8 pl-8 pr-3 rounded-md border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>

                {clients.length > 0 ? (
                  <ul className="max-h-60 overflow-y-auto">
                    {clients.map((client) => (
                      <li key={client.id}>
                        <button
                          onClick={() => selectClient(client)}
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent text-left transition-colors"
                        >
                          <div>
                            <p className="text-sm font-medium">
                              {client.prenom ?? ""} {client.nom}
                            </p>
                            {client.telephone && (
                              <p className="text-xs text-muted-foreground">{client.telephone}</p>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(client.totalAchats)}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : clientSearch.length >= 2 ? (
                  <div className="p-4 text-center">
                    <p className="text-sm text-muted-foreground">Aucun client trouvé</p>
                  </div>
                ) : (
                  <div className="p-4 text-center">
                    <p className="text-xs text-muted-foreground">Tapez au moins 2 caractères</p>
                  </div>
                )}

                <div className="p-2 border-t">
                  <button
                    onClick={() => {
                      setShowClientSearch(false);
                      setShowNouveauClient(true);
                    }}
                    className="w-full flex items-center justify-center gap-2 rounded-md border border-dashed py-2 text-xs text-muted-foreground hover:bg-muted transition-colors"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Créer un nouveau client
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tabs mobile */}
        <div className="lg:hidden flex border-b bg-muted/20 shrink-0">
          <button
            onClick={() => setMobileTab("produits")}
            className={cn(
              "flex-1 py-2.5 text-sm font-medium transition-colors",
              mobileTab === "produits" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"
            )}
          >
            Produits
          </button>
          <button
            onClick={() => setMobileTab("panier")}
            className={cn(
              "flex-1 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2",
              mobileTab === "panier" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"
            )}
          >
            Panier
            {items.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">
                {items.length}
              </span>
            )}
          </button>
        </div>

        {/* Corps : 2 colonnes desktop / tabs mobile */}
        <div className="flex flex-1 overflow-hidden">
          {/* Colonne gauche — Produits */}
          <div className={cn(
            "flex-1 flex flex-col overflow-hidden border-r",
            "lg:flex", mobileTab === "panier" ? "hidden" : "flex"
          )}>
            <div className="p-3 lg:p-4 border-b bg-muted/30 space-y-2">
              {/* 2 boutons d'entrée */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setShowCamera(true)}
                  className="flex items-center justify-center gap-2 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-bold shadow-sm hover:bg-primary/90 active:scale-95 transition-all"
                >
                  <ScanLine className="h-4 w-4" />
                  Scanner caméra
                </button>
                <div className="flex items-center justify-center gap-2 h-10 rounded-xl border bg-muted/50 text-sm font-medium text-muted-foreground px-3">
                  <Search className="h-4 w-4 shrink-0" />
                  <span className="text-xs">ou rechercher ci-dessous</span>
                </div>
              </div>
              <ProductSearch />
            </div>

            <div className={cn(
              "flex-1 flex flex-col items-center justify-center p-6 text-center",
              items.length > 0 && "hidden"
            )}>
              <div className="max-w-xs space-y-3 text-muted-foreground">
                <p className="text-3xl">🔍</p>
                <p className="font-medium">Recherchez un produit</p>
                <p className="text-sm">Tapez le nom ou scannez un code-barres.</p>
                <div className="text-xs space-y-1 bg-muted rounded-lg p-3 text-left font-mono">
                  <p>↵ Entrée → Ajouter le 1er résultat</p>
                </div>
              </div>
            </div>

          </div>

          {/* Colonne droite — Panier */}
          <div className={cn(
            "lg:w-[380px] lg:shrink-0 flex flex-col overflow-hidden bg-card",
            "lg:flex w-full", mobileTab === "produits" ? "hidden lg:flex" : "flex"
          )}>
            <CartSummary onVenteCreee={handleVenteCreee} onAddItem={() => setMobileTab("produits")} />
          </div>
        </div>
      </div>
    </>
  );
}
