// ─────────────────────────────────────────────────────────────────────────────
// PAGE /produits/nouveau — Création d'un nouveau produit
// ─────────────────────────────────────────────────────────────────────────────

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/security/rbac";
import { redirect } from "next/navigation";
import Link from "next/link";
import ProduitForm from "@/components/produits/ProduitForm";
import type { Role } from "@prisma/client";

export default async function NouveauProduitPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role as Role;
  if (!hasPermission(role, "produits:create")) redirect("/produits");

  const categories = await prisma.categorie.findMany({ orderBy: { nom: "asc" } });

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* ── En-tête ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Link href="/produits" className="text-gray-400 hover:text-gray-600 text-sm">
          ← Produits
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-900">Nouveau produit</h1>
      </div>

      <ProduitForm categories={categories} mode="create" />
    </div>
  );
}
