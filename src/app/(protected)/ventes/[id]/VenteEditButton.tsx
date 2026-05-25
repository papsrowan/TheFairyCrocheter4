"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { VenteEditModal } from "./VenteEditModal";

interface Props {
  vente: React.ComponentProps<typeof VenteEditModal>["vente"];
}

export function VenteEditButton({ vente }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {open && <VenteEditModal vente={vente} onClose={() => setOpen(false)} />}
      <div className="card p-5 border-amber-200 bg-amber-50/50 dark:bg-amber-900/10">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">Modifier la vente</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Corriger les articles, quantités, client ou mode de paiement. Stock et comptabilité mis à jour automatiquement.
            </p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-amber-500 text-white px-4 py-2 text-sm font-bold hover:bg-amber-600 active:scale-95 transition-all shadow-sm shrink-0"
          >
            <Pencil className="h-4 w-4" />
            Modifier
          </button>
        </div>
      </div>
    </>
  );
}
