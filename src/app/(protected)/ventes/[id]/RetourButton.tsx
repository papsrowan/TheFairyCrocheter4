"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { RetourModal } from "./RetourModal";

interface Props {
  venteId: string;
  lignes: React.ComponentProps<typeof RetourModal>["lignes"];
}

export function RetourButton({ venteId, lignes }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {open && <RetourModal venteId={venteId} lignes={lignes} onClose={() => setOpen(false)} />}
      <div className="card p-5 border-indigo-200 bg-indigo-50/30 dark:bg-indigo-900/5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">Retour produit</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Enregistrer le retour physique d&apos;un article. Stock restitué, remboursement partiel possible.
            </p>
          </div>
          <button onClick={() => setOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 text-white px-4 py-2 text-sm font-bold hover:bg-indigo-700 active:scale-95 transition-all shadow-sm shrink-0">
            <RotateCcw className="h-4 w-4" />
            Retour
          </button>
        </div>
      </div>
    </>
  );
}
