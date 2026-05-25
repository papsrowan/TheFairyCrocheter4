import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/security/rbac";
import { formatDateTime } from "@/lib/utils/format";
import { StickyNote } from "lucide-react";
import { NoteActions } from "./NoteActions";
import type { Role } from "@prisma/client";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Notes" };
export const dynamic = "force-dynamic";

const ENTITY_LABELS: Record<string, { label: string; color: string }> = {
  client:   { label: "Client",   color: "status-info" },
  produit:  { label: "Produit",  color: "status-warning" },
  vente:    { label: "Vente",    color: "status-success" },
  general:  { label: "Général",  color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400" },
};

interface PageProps {
  searchParams: { entityType?: string };
}

export default async function NotesPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!hasPermission(session!.user.role as Role, "notes:read")) redirect("/dashboard");

  const canDelete = hasPermission(session!.user.role as Role, "notes:delete");
  const entityType = searchParams.entityType;

  const notes = await prisma.note.findMany({
    where: entityType ? { entityType } : undefined,
    orderBy: { createdAt: "desc" },
    include: { auteur: { select: { nom: true, prenom: true } } },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Notes internes</h1>
          <p className="page-subtitle">{notes.length} note{notes.length > 1 ? "s" : ""}</p>
        </div>
        <NoteActions />
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2">
        {[
          { value: "", label: "Toutes" },
          { value: "general", label: "Général" },
          { value: "client",  label: "Clients" },
          { value: "produit", label: "Produits" },
          { value: "vente",   label: "Ventes" },
        ].map((f) => (
          <a
            key={f.value}
            href={f.value ? `?entityType=${f.value}` : "/notes"}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
              (entityType ?? "") === f.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {f.label}
          </a>
        ))}
      </div>

      {/* Liste */}
      {notes.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <StickyNote className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">Aucune note pour le moment</p>
          <p className="text-sm text-muted-foreground/60 mt-1">Créez votre première note ci-dessus</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((note) => {
            const meta = ENTITY_LABELS[note.entityType] ?? ENTITY_LABELS.general;
            return (
              <div key={note.id} className="card-hover p-4 space-y-3 group">
                <div className="flex items-start justify-between gap-2">
                  <span className={cn("status-badge", meta.color)}>{meta.label}</span>
                  {canDelete && (
                    <NoteActions noteId={note.id} isDelete />
                  )}
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{note.contenu}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-2">
                  <span>{note.auteur.prenom} {note.auteur.nom}</span>
                  <span>{formatDateTime(note.createdAt)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
