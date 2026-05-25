"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Timer } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const KEY = "tfc_session_start";

function fmt(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

export function SessionTimer() {
  const { data: session, status } = useSession();
  const [elapsed, setElapsed]     = useState<number | null>(null);

  // Initialise le timestamp à la connexion
  useEffect(() => {
    if (status === "authenticated") {
      if (!localStorage.getItem(KEY)) {
        localStorage.setItem(KEY, String(Date.now()));
      }
    }
    if (status === "unauthenticated") {
      localStorage.removeItem(KEY);
      setElapsed(null);
    }
  }, [status]);

  // Mise à jour chaque seconde
  useEffect(() => {
    if (status !== "authenticated") return;
    const tick = () => {
      const start = parseInt(localStorage.getItem(KEY) ?? "0");
      if (!start) return;
      setElapsed(Math.floor((Date.now() - start) / 1000));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [status]);

  // N'affiche rien avant 1 minute
  if (!session || elapsed === null || elapsed < 60) return null;

  const hours = Math.floor(elapsed / 3600);
  const warn  = elapsed > 8 * 3600; // alerte après 8h

  return (
    <div className={cn(
      "hidden sm:flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-lg",
      warn
        ? "text-amber-600 bg-amber-50 dark:bg-amber-900/20"
        : "text-muted-foreground bg-muted/50"
    )} title="Temps de session">
      <Timer className="h-3 w-3" />
      <span>{fmt(elapsed)}</span>
    </div>
  );
}
