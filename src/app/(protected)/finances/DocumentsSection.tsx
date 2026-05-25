"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Receipt, Eye, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const MODE_LABELS: Record<string, string> = {
  ESPECES: "Espèces", CARTE: "Carte", VIREMENT: "Virement", CHEQUE: "Chèque", MIXTE: "Mixte",
};

function fmtXAF(n: number) {
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n) + " XAF";
}

function fmtDate(d: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(d));
}

interface Vente {
  id: string; numero: string; createdAt: string;
  total: number; modePaiement: string;
  client?: { nom: string; prenom?: string | null } | null;
  _count: { lignes: number };
}

interface Props {
  ventes: Vente[];
  total:  number;
}

export function DocumentsSection({ ventes, total }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header cliquable */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <span className="font-semibold">Factures &amp; Tickets</span>
          <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
            {total} vente{total > 1 ? "s" : ""}
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <>
          {ventes.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm border-t border-border">
              Aucune vente ce mois
            </div>
          ) : (
            <div className="border-t border-border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <th className="px-4 py-3 text-left">N° Vente</th>
                    <th className="px-4 py-3 text-left hidden sm:table-cell">Date</th>
                    <th className="px-4 py-3 text-left hidden md:table-cell">Client</th>
                    <th className="px-4 py-3 text-left hidden sm:table-cell">Paiement</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-center">Documents</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {ventes.map((v) => (
                    <tr key={v.id} onClick={() => router.push(`/ventes/${v.id}`)} className="hover:bg-muted/20 transition-colors cursor-pointer">
                      <td className="px-4 py-3">
                        <span className="font-mono font-semibold text-primary text-xs">{v.numero}</span>
                        <span className="text-xs text-muted-foreground ml-1.5">({v._count.lignes} art.)</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs hidden sm:table-cell whitespace-nowrap">
                        {fmtDate(v.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-sm hidden md:table-cell">
                        {v.client
                          ? `${v.client.prenom ? v.client.prenom + " " : ""}${v.client.nom}`
                          : <span className="text-muted-foreground italic text-xs">Comptoir</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">
                        {MODE_LABELS[v.modePaiement] ?? v.modePaiement}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-sm">
                        {fmtXAF(v.total)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {/* Reçu HTML — voir + imprimer */}
                          <a
                            href={`/documents/recu/${v.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Voir et imprimer le reçu"
                            className={cn(
                              "inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium",
                              "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                            )}
                          >
                            <Eye className="h-3 w-3" />
                            <span className="hidden sm:inline">Reçu</span>
                          </a>

                          {/* Ticket PDF */}
                          <a
                            href={`/api/documents/ticket/${v.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Télécharger le ticket PDF"
                            className={cn(
                              "inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium",
                              "bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                            )}
                          >
                            <Receipt className="h-3 w-3" />
                            <span className="hidden sm:inline">Ticket</span>
                          </a>

                          {/* Facture PDF */}
                          <a
                            href={`/api/documents/facture/${v.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Télécharger la facture PDF"
                            className={cn(
                              "inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium",
                              "bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                            )}
                          >
                            <FileText className="h-3 w-3" />
                            <span className="hidden sm:inline">Facture</span>
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
                <span>Affichage des 30 dernières ventes</span>
                <a href="/documents" className="text-primary hover:underline font-medium">
                  Voir tous les documents →
                </a>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
