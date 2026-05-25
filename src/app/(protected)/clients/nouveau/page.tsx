// ─────────────────────────────────────────────────────────────────────────────
// PAGE /clients/nouveau — Formulaire de création d'un client
// Server Component — vérification permission + précharge catégories
// ─────────────────────────────────────────────────────────────────────────────

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/security/rbac";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ClientForm } from "@/components/clients/ClientForm";
import type { Role } from "@prisma/client";

export default async function NouveauClientPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role as Role;
  if (!hasPermission(role, "clients:create")) {
    redirect("/clients?error=access_denied");
  }

  const categories = await prisma.categorieClient.findMany({
    orderBy: { nom: "asc" },
  });

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      {/* ── En-tête ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Link
          href="/clients"
          className="text-gray-400 hover:text-gray-600 transition-colors"
          title="Retour à la liste"
        >
          ←
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nouveau client</h1>
          <p className="text-sm text-gray-500 mt-0.5">Enregistrer un nouveau client dans la base</p>
        </div>
      </div>

      {/* ── Formulaire ───────────────────────────────────────────────── */}
      <ClientForm mode="create" categories={categories} />
    </div>
  );
}
