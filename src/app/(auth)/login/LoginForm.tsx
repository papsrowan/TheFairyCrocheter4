"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Loader2, Mail, Lock, AlertCircle, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const loginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

interface LoginFormProps {
  callbackUrl?: string;
  error?: string;
}

const ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin: "Email ou mot de passe incorrect.",
  CallbackRouteError: "Email ou mot de passe incorrect.",
  access_denied: "Vous n'avez pas les permissions pour accéder à cette page.",
  default: "Une erreur est survenue. Réessayez.",
};

export function LoginForm({ callbackUrl, error }: LoginFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(
    error ? (ERROR_MESSAGES[error] ?? ERROR_MESSAGES.default) : null
  );
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);
    const rawData = {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
    };

    const parsed = loginSchema.safeParse(rawData);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      parsed.error.errors.forEach((err) => {
        if (err.path[0]) errors[err.path[0] as string] = err.message;
      });
      setFieldErrors(errors);
      return;
    }

    setIsLoading(true);
    try {
      const result = await signIn("credentials", {
        email: parsed.data.email,
        password: parsed.data.password,
        redirect: false,
      });

      if (result?.error) {
        setFormError(ERROR_MESSAGES[result.error] ?? ERROR_MESSAGES.default);
        return;
      }

      router.push(callbackUrl ?? "/dashboard");
      router.refresh();
    } catch {
      setFormError("Erreur de connexion. Vérifiez votre réseau.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="animate-in">
      {/* En-tête */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-foreground"> Gardez le sourire SVP</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Connectez-vous à votre espace de gestion
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {/* Erreur globale */}
        {formError && (
          <div className="flex items-start gap-3 rounded-xl bg-destructive/8 border border-destructive/20 p-3.5 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* Email */}
        <div className="form-group">
          <label htmlFor="email" className="form-label">Adresse email</label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              disabled={isLoading}
              className={cn(
                "form-input pl-10",
                fieldErrors.email && "border-destructive focus:ring-destructive"
              )}
              placeholder="Entrez votre email"
            />
          </div>
          {fieldErrors.email && (
            <p className="text-xs text-destructive mt-1">{fieldErrors.email}</p>
          )}
        </div>

        {/* Mot de passe */}
        <div className="form-group">
          <label htmlFor="password" className="form-label">Mot de passe</label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              disabled={isLoading}
              className={cn(
                "form-input pl-10 pr-10",
                fieldErrors.password && "border-destructive focus:ring-destructive"
              )}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {fieldErrors.password && (
            <p className="text-xs text-destructive mt-1">{fieldErrors.password}</p>
          )}
        </div>

        {/* Bouton */}
        <button
          type="submit"
          disabled={isLoading}
          className="btn-primary w-full h-11 mt-2"
          style={{ background: isLoading ? undefined : "linear-gradient(135deg, hsl(25 65% 32%), hsl(33 72% 45%), hsl(40 82% 56%))" }}
        >
          {isLoading ? (
            <><Loader2 className="h-4 w-4 animate-spin" />Connexion en cours...</>
          ) : (
            "Se connecter"
          )}
        </button>
      </form>

      <p className="text-center text-xs text-muted-foreground mt-6">
        The Fairy Crocheter — Gestion Commerciale ERP/POS
      </p>
    </div>
  );
}
