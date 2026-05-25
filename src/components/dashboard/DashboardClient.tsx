"use client";

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSANT DashboardClient — Orchestrateur temps réel du dashboard
// Reçoit les données initiales du server component, s'abonne aux SSE
// et propage les mises à jour à tous les sous-composants
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useEffect, useRef } from "react";
import { useSSE } from "@/hooks/useSSE";
import { DashboardStats } from "./DashboardStats";
import { VentesChart } from "./VentesChart";
import { StockAlertes } from "./StockAlertes";
import { VentesRecentes } from "./VentesRecentes";
import { HorlogeNumerique } from "./HorlogeNumerique";
import Link from "next/link";
import { Clock, CheckCircle, XCircle } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProduitAlerte {
  id:           string;
  nom:          string;
  stockActuel:  number;
  stockMinimum: number;
  categorie:    { nom: string } | null;
}

interface VenteRecente {
  id:           string;
  numero:       string;
  total:        number;
  modePaiement: "ESPECES" | "CARTE" | "VIREMENT" | "CHEQUE" | "MIXTE" | "CREDIT";
  createdAt:    string;
  client:       { nom: string; prenom: string | null } | null;
  vendeur:      { nom: string; prenom: string };
  isNew?:       boolean;
}

interface JourData {
  date:  string;
  total: number;
  nb:    number;
}

interface InitialData {
  ventesAujourdhui: { count: number; total: number };
  evolutionCA:      number | null;
  produitsAlertes:  ProduitAlerte[];
  clientsActifs:    number;
  ventesRecentes:   VenteRecente[];
  caParJour:        JourData[];
  showFinances:     boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Donne la date locale au format "YYYY-MM-DD"
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── Composant ───────────────────────────────────────────────────────────────

interface DemandeResumee {
  id: string; type: string; statut: string;
  venteNumero: string; createdAt: string;
}

interface Props extends InitialData {
  isManager?: boolean;
  demandes?:  DemandeResumee[];
}

export function DashboardClient({
  ventesAujourdhui:  initVentes,
  evolutionCA:       initEvolution,
  produitsAlertes:   initAlertes,
  clientsActifs:     initClients,
  ventesRecentes:    initRecentes,
  caParJour:         initChart,
  showFinances,
  isManager = false,
  demandes = [],
}: Props) {
  // ── État du dashboard ───────────────────────────────────────────────────
  const [ventesCount,   setVentesCount]   = useState(initVentes.count);
  const [ventesTotal,   setVentesTotal]   = useState(initVentes.total);
  const [evolutionCA,   setEvolutionCA]   = useState(initEvolution);
  const [alertes,       setAlertes]       = useState(initAlertes);
  const [clientsActifs, setClientsActifs] = useState(initClients);
  const [recentes,      setRecentes]      = useState(initRecentes);
  const [caParJour,     setCaParJour]     = useState(initChart);

  // Pulses pour les animations flash
  const [pulseVentes,   setPulseVentes]   = useState(false);
  const [pulseAlertes,  setPulseAlertes]  = useState(false);
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Indicateur de connexion SSE
  const [connected, setConnected] = useState(false);

  function flashPulse(setPulse: (v: boolean) => void) {
    setPulse(true);
    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = setTimeout(() => setPulse(false), 2000);
  }

  // ── Handlers SSE ────────────────────────────────────────────────────────

  const handleVenteCreated = useCallback((data: {
    venteId:   string;
    numero:    string;
    total:     number;
    clientNom: string | null;
    vendeurId: string;
    createdAt: string;
  }) => {
    // Mettre à jour les compteurs
    setVentesCount((c) => c + 1);
    setVentesTotal((t) => t + data.total);

    // Ajouter en tête de liste, garder max 5
    const nouvelleVente: VenteRecente = {
      id:           data.venteId,
      numero:       data.numero,
      total:        data.total,
      modePaiement: "ESPECES", // valeur par défaut — sera rafraîchie au prochain reload
      createdAt:    data.createdAt,
      client:       data.clientNom ? { nom: data.clientNom, prenom: null } : null,
      vendeur:      { nom: "", prenom: "" },
      isNew:        true,
    };
    setRecentes((prev) => [nouvelleVente, ...prev].slice(0, 5));

    // Mettre à jour la série 7 jours
    const today = todayStr();
    setCaParJour((prev) =>
      prev.map((d) =>
        d.date === today ? { ...d, total: d.total + data.total, nb: d.nb + 1 } : d
      )
    );

    flashPulse(setPulseVentes);

    // Retirer le flash "new" après 4s
    setTimeout(() => {
      setRecentes((prev) =>
        prev.map((v) => (v.id === data.venteId ? { ...v, isNew: false } : v))
      );
    }, 4000);
  }, []);

  const handleStockAlerte = useCallback((data: {
    produitId:    string;
    nom:          string;
    stockActuel:  number;
    stockMinimum: number;
  }) => {
    setAlertes((prev) => {
      const exists = prev.find((a) => a.id === data.produitId);
      if (exists) {
        // Mettre à jour le stock du produit existant
        return prev.map((a) =>
          a.id === data.produitId ? { ...a, stockActuel: data.stockActuel } : a
        );
      }
      // Ajouter le nouveau produit en alerte
      return [
        ...prev,
        {
          id:           data.produitId,
          nom:          data.nom,
          stockActuel:  data.stockActuel,
          stockMinimum: data.stockMinimum,
          categorie:    null,
        },
      ];
    });
    flashPulse(setPulseAlertes);
  }, []);

  const handleStockUpdated = useCallback((data: {
    produitId:   string;
    stockActuel: number;
  }) => {
    // Retirer de la liste d'alertes si le stock est repassé au-dessus du minimum
    setAlertes((prev) => {
      const produit = prev.find((a) => a.id === data.produitId);
      if (!produit) return prev;
      if (data.stockActuel >= produit.stockMinimum) {
        return prev.filter((a) => a.id !== data.produitId);
      }
      return prev.map((a) =>
        a.id === data.produitId ? { ...a, stockActuel: data.stockActuel } : a
      );
    });
  }, []);

  const handleClientCreated = useCallback(() => {
    setClientsActifs((c) => c + 1);
  }, []);

  const handlePing = useCallback(() => {
    setConnected(true);
  }, []);

  // ── Connexion SSE ────────────────────────────────────────────────────────
  useSSE({
    channel: "global",
    handlers: {
      "vente.created":  handleVenteCreated,
      "stock.alerte":   handleStockAlerte,
      "stock.updated":  handleStockUpdated,
      "client.created": handleClientCreated,
      "ping":           handlePing,
    },
  });

  // Marquer connecté au premier ping
  useEffect(() => {
    const timer = setTimeout(() => setConnected(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  // Nettoyage
  useEffect(() => {
    return () => {
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    };
  }, []);

  // ── Rendu ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Horloge + demandes — MANAGER uniquement */}
      {isManager && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <HorlogeNumerique />
          <div className="card p-5">
            <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Mes demandes
              {demandes.filter(d => d.statut === "EN_ATTENTE").length > 0 && (
                <span className="ml-auto bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {demandes.filter(d => d.statut === "EN_ATTENTE").length} en attente
                </span>
              )}
            </h2>
            {demandes.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Aucune demande envoyée</p>
            ) : (
              <div className="space-y-2">
                {demandes.slice(0, 4).map(d => (
                  <Link key={d.id} href={`/ventes/${d.id}`}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors">
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{d.type} — {d.venteNumero}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(d.createdAt).toLocaleDateString("fr-FR")}</p>
                    </div>
                    {d.statut === "EN_ATTENTE"  && <Clock      className="h-3.5 w-3.5 text-amber-500 shrink-0 ml-2" />}
                    {d.statut === "APPROUVEE"   && <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0 ml-2" />}
                    {d.statut === "REJETEE"     && <XCircle    className="h-3.5 w-3.5 text-red-500 shrink-0 ml-2" />}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bouton caisse prominent + SSE */}
      <div className="flex items-center justify-between gap-3">
        <a
          href="/ventes/nouvelle"
          className="flex items-center gap-2.5 rounded-xl bg-primary text-primary-foreground px-5 py-3 font-bold shadow-md shadow-primary/30 hover:bg-primary/90 transition-all active:scale-95"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 5h18M3 5v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5M3 5l2-2h14l2 2"/><line x1="12" y1="10" x2="12" y2="17"/><line x1="8" y1="14" x2="16" y2="14"/></svg>
          Nouvelle vente / Scanner
        </a>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${connected ? "bg-green-400" : "bg-gray-300"}`} />
          {connected ? "Temps réel actif" : "Connexion..."}
        </div>
      </div>

      {/* 4 cartes de stats */}
      <DashboardStats
        ventesCount={ventesCount}
        ventesTotal={ventesTotal}
        evolutionCA={evolutionCA}
        alertesCount={alertes.length}
        clientsActifs={clientsActifs}
        showFinances={showFinances}
        pulseVentes={pulseVentes}
        pulseAlertes={pulseAlertes}
      />

      {/* Graphique 7 jours */}
      <VentesChart data={caParJour} showFinances={showFinances} />

      {/* Alertes + Ventes récentes côte à côte */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StockAlertes alertes={alertes} />
        <VentesRecentes ventes={recentes} />
      </div>
    </div>
  );
}
