"use client";

// Scanne les barcodes via la caméra et ajoute les produits au panier.
// Utilise @zxing/browser (EAN-13, CODE128, QR…). Chargé en dynamic pour SSR.

import { useEffect, useRef, useState, useCallback } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { NotFoundException } from "@zxing/library";
import type { IScannerControls } from "@zxing/browser";
import { useCartStore } from "@/stores/cartStore";
import { formatCurrency } from "@/lib/utils/format";
import { X, ScanLine, CheckCircle, AlertCircle, Loader2, FlipHorizontal } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface ScannedItem {
  barcode: string;
  nom: string;
  prix: number;
  qty: number;
  ok: boolean;
}

interface Props {
  onClose: () => void;
}

export function CameraScanner({ onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const lastScanRef = useRef<string>(""); // anti-doublon
  const lastScanTimeRef = useRef<number>(0);

  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [camIdx, setCamIdx] = useState(0);
  const [scanned, setScanned] = useState<ScannedItem[]>([]);
  const [scanning, setScanning] = useState(false);
  const [flash, setFlash] = useState<"ok" | "err" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addItem = useCartStore((s) => s.addItem);

  // Cherche le produit par code-barres
  const searchProduct = useCallback(async (barcode: string): Promise<ScannedItem> => {
    try {
      const res = await fetch(`/api/produits/search?q=${encodeURIComponent(barcode)}&limit=1`);
      if (!res.ok) throw new Error();
      const json = await res.json() as { data: Array<{ id: string; nom: string; prixVente: number; prixGros?: number | null; qtePrixGros?: number | null; tauxTVA: number; stockActuel: number; stockMinimum: number; codeBarres?: string }> };
      const p = json.data.find(d => d.codeBarres === barcode) ?? json.data[0];
      if (!p) return { barcode, nom: "Produit introuvable", prix: 0, qty: 1, ok: false };

      addItem({
        produitId: p.id,
        nom: p.nom,
        codeBarres: barcode,
        quantite: 1,
        prixBase: p.prixVente,
        prixGros: p.prixGros,
        qtePrixGros: p.qtePrixGros,
        prixGrosApplique: false,
        prixUnitaire: p.prixVente,
        remise: 0,
        tauxTVA: p.tauxTVA,
      });
      return { barcode, nom: p.nom, prix: p.prixVente, qty: 1, ok: true };
    } catch {
      return { barcode, nom: "Erreur réseau", prix: 0, qty: 1, ok: false };
    }
  }, [addItem]);

  // Démarrer le scan
  const startScan = useCallback(async (deviceId?: string) => {
    if (!videoRef.current) return;
    setError(null);
    setScanning(true);

    try {
      controlsRef.current?.stop();
      const reader = new BrowserMultiFormatReader();

      const allCams = await BrowserMultiFormatReader.listVideoInputDevices();
      if (allCams.length === 0) throw new Error("Aucune caméra détectée");
      setCameras(allCams);

      const selectedId = deviceId ?? allCams[camIdx]?.deviceId ?? allCams[0].deviceId;

      const controls = await reader.decodeFromVideoDevice(selectedId, videoRef.current, async (result, err) => {
        if (err instanceof NotFoundException) return;
        if (!result) return;

        const barcode = result.getText();
        const now = Date.now();

        if (barcode === lastScanRef.current && now - lastScanTimeRef.current < 2000) return;
        lastScanRef.current = barcode;
        lastScanTimeRef.current = now;

        const item = await searchProduct(barcode);
        setFlash(item.ok ? "ok" : "err");
        setTimeout(() => setFlash(null), 800);

        setScanned(prev => {
          const existing = prev.find(s => s.barcode === barcode);
          if (existing) return prev.map(s => s.barcode === barcode ? { ...s, qty: s.qty + 1 } : s);
          return [item, ...prev];
        });
      });
      controlsRef.current = controls;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Impossible d'accéder à la caméra";
      setError(msg);
      setScanning(false);
    }
  }, [camIdx, searchProduct]);

  useEffect(() => {
    startScan();
    return () => { controlsRef.current?.stop(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchCamera = () => {
    const nextIdx = (camIdx + 1) % cameras.length;
    setCamIdx(nextIdx);
    controlsRef.current?.stop();
    startScan(cameras[nextIdx]?.deviceId);
  };

  const totalItems = scanned.filter(s => s.ok).reduce((s, i) => s + i.qty, 0);

  return (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col">
      {/* Vidéo plein écran */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        muted
      />

      {/* Flash feedback */}
      {flash && (
        <div className={cn(
          "absolute inset-0 z-10 pointer-events-none transition-opacity",
          flash === "ok" ? "bg-green-400/30" : "bg-red-400/30"
        )} />
      )}

      {/* Overlay UI */}
      <div className="relative z-20 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-black/60">
          <div className="flex items-center gap-2 text-white">
            <ScanLine className="h-5 w-5 text-primary" />
            <span className="font-bold">Scanner un produit</span>
            {totalItems > 0 && (
              <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                {totalItems} article{totalItems > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {cameras.length > 1 && (
              <button onClick={switchCamera} className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors">
                <FlipHorizontal className="h-4 w-4" />
              </button>
            )}
            <button onClick={onClose} className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Zone de scan centrale */}
        <div className="flex-1 flex items-center justify-center">
          {error ? (
            <div className="text-center px-8">
              <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
              <p className="text-white font-medium">{error}</p>
              <button onClick={() => startScan()} className="mt-4 px-4 py-2 bg-primary rounded-lg text-white text-sm font-medium">
                Réessayer
              </button>
            </div>
          ) : !scanning ? (
            <Loader2 className="h-10 w-10 text-white animate-spin" />
          ) : (
            // Viseur
            <div className="relative w-64 h-40">
              <div className="absolute inset-0 border-2 border-white/30 rounded-lg" />
              {/* Coins */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
              {/* Ligne scan animée */}
              <div className="absolute inset-x-2 h-0.5 bg-primary/80 animate-scan-line" style={{ top: "50%" }} />
              <p className="absolute -bottom-8 inset-x-0 text-center text-white/70 text-xs">
                Centrez le code-barres dans le viseur
              </p>
            </div>
          )}
        </div>

        {/* Liste des produits scannés */}
        {scanned.length > 0 && (
          <div className="bg-black/80 backdrop-blur-sm max-h-48 overflow-y-auto">
            {scanned.map((item, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5 border-b border-white/10">
                {item.ok
                  ? <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />
                  : <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-medium truncate", item.ok ? "text-white" : "text-red-300")}>
                    {item.nom}
                  </p>
                  <p className="text-xs text-white/50 font-mono">{item.barcode}</p>
                </div>
                <div className="text-right shrink-0">
                  {item.ok && <p className="text-sm font-bold text-primary">{formatCurrency(item.prix)}</p>}
                  {item.qty > 1 && <p className="text-xs text-white/50">×{item.qty}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-3 bg-black/80 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-11 rounded-xl border border-white/20 text-white text-sm font-medium hover:bg-white/10 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={onClose}
            disabled={totalItems === 0}
            className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-40 hover:bg-primary/90 transition-colors"
          >
            Valider le panier ({totalItems})
          </button>
        </div>
      </div>
    </div>
  );
}
