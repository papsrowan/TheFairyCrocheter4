import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/security/rbac";
import { ParametresForm } from "./ParametresForm";
import { ClearCacheButton } from "@/components/parametres/ClearCacheButton";
import type { Role } from "@prisma/client";

export const metadata: Metadata = { title: "Paramètres" };
export const dynamic = "force-dynamic";

export default async function ParametresPage() {
  const session = await auth();
  if (!hasPermission(session!.user.role as Role, "parametres:read")) redirect("/dashboard");

  const canEdit = hasPermission(session!.user.role as Role, "parametres:update");
  const entreprise = await prisma.entreprise.findFirst();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="page-title">Paramètres</h1>
        <p className="page-subtitle">Configuration de l&apos;entreprise et de l&apos;application</p>
      </div>
      <ParametresForm entreprise={entreprise} canEdit={canEdit} />
      <div className="card p-5">
        <h2 className="font-semibold mb-1">Application</h2>
        <ClearCacheButton />
      </div>
    </div>
  );
}
