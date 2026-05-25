"use client";

import { useState } from "react";
import { Share2, Download, Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface Props {
  url: string;
  filename: string;
  title?: string;
  label?: string;
  variant?: "primary" | "secondary" | "ghost";
}

export function ShareButton({ url, filename, title, label = "Partager", variant = "secondary" }: Props) {
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== "undefined" && !!navigator.share;

  async function handleShare() {
    if (canShare) {
      try {
        const res  = await fetch(url);
        const blob = await res.blob();
        const file = new File([blob], filename, { type: "application/pdf" });

        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: title ?? filename });
          return;
        }
        await navigator.share({ title: title ?? filename, url: window.location.href });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const cls = cn(
    "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all active:scale-[0.97]",
    variant === "primary"   && "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
    variant === "secondary" && "bg-secondary text-secondary-foreground border border-border hover:bg-secondary/70",
    variant === "ghost"     && "text-muted-foreground hover:bg-muted hover:text-foreground",
  );

  return (
    <button onClick={handleShare} className={cls}>
      {copied ? <Check className="h-4 w-4" /> : canShare ? <Share2 className="h-4 w-4" /> : <Download className="h-4 w-4" />}
      {copied ? "Téléchargé" : label}
    </button>
  );
}
