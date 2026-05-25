"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { StickyNote } from "lucide-react";

interface Note {
  id:        string;
  contenu:   string;
  auteur:    string;
  createdAt: string;
}

interface Props {
  notes: Note[];
}

export function NotesTicker({ notes }: Props) {
  const trackRef  = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  if (!notes.length) return null;

  // On duplique la liste pour créer un scroll infini sans saut
  const doubled = [...notes, ...notes];

  return (
    <div
      className="flex items-center gap-3 rounded-xl border bg-card overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Label fixe */}
      <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 text-primary shrink-0 border-r">
        <StickyNote className="h-4 w-4 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider whitespace-nowrap">Notes</span>
      </div>

      {/* Piste scrollante */}
      <div className="flex-1 overflow-hidden py-2 pr-3">
        <div
          ref={trackRef}
          className={cn(
            "flex gap-8 whitespace-nowrap",
            !paused && "animate-ticker"
          )}
          style={paused ? undefined : undefined}
        >
          {doubled.map((note, i) => (
            <span key={`${note.id}-${i}`} className="inline-flex items-center gap-2 text-sm shrink-0">
              <span className="text-xs text-muted-foreground font-medium shrink-0">
                {note.auteur}
              </span>
              <span className="text-foreground">{note.contenu}</span>
              <span className="text-muted-foreground/40 text-xs">·</span>
              <span className="text-xs text-muted-foreground">
                {new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(note.createdAt))}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
