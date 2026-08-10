"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Calendar, X } from "lucide-react";

export function ExportStockModal() {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<string>("");

  const handleExport = (format: "csv" | "pdf") => {
    let url = `/api/produits/export-stock?format=${format}`;
    if (date) {
      url += `&date=${encodeURIComponent(date)}`;
    }
    if (format === "pdf") {
      window.open(url, "_blank");
    } else {
      window.location.href = url;
    }
    setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative z-10 inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
      >
        <Download className="h-4 w-4" /> Export Stock
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-card rounded-2xl p-6 shadow-2xl space-y-5 border border-border">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground">Exporter le Stock</h3>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Choisissez une date pour extraire l&apos;état des stocks à ce moment précis (laisser vide pour le stock actuel).
            </p>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Date du stock (Optionnel)
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {date && (
                <button
                  type="button"
                  onClick={() => setDate("")}
                  className="text-xs text-primary underline"
                >
                  Réinitialiser à la date d&apos;aujourd&apos;hui (stock actuel)
                </button>
              )}
            </div>

            <div className="pt-2 grid grid-cols-2 gap-3">
              <button
                onClick={() => handleExport("csv")}
                className="flex items-center justify-center gap-2 h-11 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold text-sm hover:bg-emerald-100 transition-all active:scale-95"
              >
                <FileSpreadsheet className="h-4 w-4" /> Export Excel
              </button>
              <button
                onClick={() => handleExport("pdf")}
                className="flex items-center justify-center gap-2 h-11 rounded-xl bg-red-50 text-red-700 border border-red-200 font-semibold text-sm hover:bg-red-100 transition-all active:scale-95"
              >
                <FileText className="h-4 w-4" /> Export PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
