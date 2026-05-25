"use client";

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDERS — Wrapper global pour tous les providers React côté client
// QueryClient, SessionProvider, ThemeProvider, Toaster
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import type { Session } from "next-auth";
import { useSync } from "@/hooks/useSync";
import { useOfflineCache } from "@/hooks/useOfflineCache";

interface ProvidersProps {
  children: React.ReactNode;
  session: Session | null;
}

function OfflineServices() {
  useSync();
  useOfflineCache();
  return null;
}

export function Providers({ children, session }: ProvidersProps) {
  // Créer le QueryClient une seule fois par composant (pas au module level)
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Stratégie de cache par défaut
            staleTime: 30 * 1000,          // 30 secondes
            gcTime: 5 * 60 * 1000,          // 5 minutes en mémoire
            retry: (failureCount, error) => {
              // Ne pas retenter sur les erreurs 4xx
              if (error instanceof Error && error.message.includes("4")) {
                return false;
              }
              return failureCount < 3;
            },
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,       // Refetch automatique au retour connexion
          },
          mutations: {
            retry: 1,
          },
        },
      })
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <SessionProvider session={session}>
        <QueryClientProvider client={queryClient}>
          <OfflineServices />
          {children}
          {process.env.NODE_ENV === "development" && (
            <ReactQueryDevtools initialIsOpen={false} />
          )}
        </QueryClientProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
