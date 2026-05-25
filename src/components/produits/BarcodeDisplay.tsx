"use client";

import Barcode from "react-barcode";
import { Download } from "lucide-react";
import { useRef } from "react";

interface Props { value: string; nom: string }

export function BarcodeDisplay({ value, nom }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);

  function handlePrint() {
    const win = window.open("", "_blank", "width=400,height=300");
    if (!win) return;
    const svg = wrapRef.current?.querySelector("svg")?.outerHTML ?? "";
    win.document.write(`
      <html><head><title>Code-barres ${nom}</title>
      <style>body{margin:0;display:flex;flex-direction:column;align-items:center;padding:16px;font-family:monospace;font-size:11px}
      p{margin:4px 0}</style></head>
      <body>${svg}<p>${nom}</p><p>${value}</p>
      <script>window.onload=()=>{window.print();window.close()}<\/script></body></html>
    `);
    win.document.close();
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div ref={wrapRef} className="bg-white rounded-xl p-3 border">
        <Barcode
          value={value}
          format="EAN13"
          width={1.8}
          height={60}
          fontSize={12}
          margin={4}
          background="#ffffff"
          lineColor="#1a1a1a"
        />
      </div>
      <p className="text-xs font-mono text-muted-foreground">{value}</p>
      <button onClick={handlePrint} className="btn-ghost text-xs py-1.5">
        <Download className="h-3.5 w-3.5" /> Imprimer
      </button>
    </div>
  );
}
