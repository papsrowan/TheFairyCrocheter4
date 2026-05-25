import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/security/rbac";
import { formatDateTime } from "@/lib/utils/format";
import { Users } from "lucide-react";
import { UtilisateurActions } from "./UtilisateurActions";
import type { Role } from "@prisma/client";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Utilisateurs" };
export const dynamic = "force-dynamic";

const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
  SUPER_ADMIN:  { label: "Super Admin",  color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" },
  MANAGER:      { label: "Gérante",      color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  CAISSIER:     { label: "Caissier",     color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  DISTRIBUTEUR: { label: "Distributeur", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
};

export default async function UtilisateursPage() {
  const session = await auth();
  if (!hasPermission(session!.user.role as Role, "utilisateurs:read")) redirect("/dashboard");

  const canCreate = hasPermission(session!.user.role as Role, "utilisateurs:create");
  const currentUserId = session!.user.id;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true, nom: true, prenom: true, email: true,
      role: true, actif: true, lastLoginAt: true, createdAt: true,
    },
  });

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Utilisateurs</h1>
          <p className="page-subtitle">{users.length} compte{users.length > 1 ? "s" : ""}</p>
        </div>
        {canCreate && <UtilisateurActions />}
      </div>

      {/* Cartes utilisateurs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {users.map((user) => {
          const roleInfo = ROLE_CONFIG[user.role] ?? { label: user.role, color: "bg-muted text-muted-foreground" };
          const initials = [user.prenom?.[0], user.nom[0]].filter(Boolean).join("").toUpperCase();
          const isSelf = user.id === currentUserId;

          return (
            <div key={user.id} className={cn("card p-5 space-y-4", !user.actif && "opacity-60")}>
              <div className="flex items-start justify-between gap-3">
                {/* Avatar */}
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                    style={{ background: user.actif
                      ? "linear-gradient(135deg, hsl(25 65% 32%), hsl(40 82% 55%))"
                      : "hsl(var(--muted))" }}
                  >
                    {user.actif ? initials : <Users className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {user.prenom} {user.nom}
                      {isSelf && <span className="ml-1.5 text-xs text-muted-foreground">(vous)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                </div>

                {/* Actions */}
                {!isSelf && <UtilisateurActions user={user} />}
              </div>

              <div className="flex items-center justify-between">
                <span className={cn("status-badge", roleInfo.color)}>{roleInfo.label}</span>
                <span className={cn(
                  "status-badge",
                  user.actif ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700"
                )}>
                  {user.actif ? "Actif" : "Désactivé"}
                </span>
              </div>

              <p className="text-xs text-muted-foreground border-t pt-3">
                {user.lastLoginAt
                  ? `Dernière connexion : ${formatDateTime(user.lastLoginAt)}`
                  : "Jamais connecté"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
