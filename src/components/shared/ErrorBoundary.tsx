"use client";

// ─────────────────────────────────────────────────────────────────────────────
// ERROR BOUNDARY — Capture les erreurs React et affiche un fallback élégant
// ─────────────────────────────────────────────────────────────────────────────

import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error("ErrorBoundary caught:", error);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center min-h-[200px]">
          <AlertTriangle className="h-10 w-10 text-destructive mb-4" />
          <h3 className="font-semibold text-destructive mb-2">
            Une erreur est survenue
          </h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-sm">
            {this.state.error?.message ?? "Erreur inattendue"}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: undefined })}
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            <RefreshCw className="h-4 w-4" />
            Réessayer
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Version Next.js App Router (error.tsx)
export function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8">
      <AlertTriangle className="h-16 w-16 text-destructive mb-6" />
      <h2 className="text-2xl font-bold mb-2">Quelque chose s&apos;est mal passé</h2>
      <p className="text-muted-foreground mb-6 max-w-md">
        {error.message || "Une erreur inattendue s'est produite."}
      </p>
      <button
        onClick={reset}
        className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        <RefreshCw className="h-4 w-4" />
        Réessayer
      </button>
    </div>
  );
}
