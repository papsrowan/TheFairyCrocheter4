// ─────────────────────────────────────────────────────────────────────────────
// PAGE DE CONNEXION
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Connexion",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string; error?: string };
}) {
  const session = await auth();

  // Déjà connecté → rediriger
  if (session?.user) {
    redirect(searchParams.callbackUrl ?? "/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="w-full max-w-md">
        {/* Logo / Titre */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground text-2xl font-bold mb-4 shadow-lg">
            G
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            Gestion Commerciale
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Connectez-vous pour accéder à votre espace
          </p>
        </div>

        {/* Formulaire */}
        <div className="bg-card rounded-2xl border shadow-sm p-8">
          <LoginForm
            callbackUrl={searchParams.callbackUrl}
            error={searchParams.error}
          />
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          Données hébergées en France · Conforme RGPD
        </p>
      </div>
    </div>
  );
}
