"use client";

// ─────────────────────────────────────────────────────────────────────────────
// HOOK useSSE — Connexion persistante au flux Server-Sent Events
// Reconnexion automatique avec backoff exponentiel
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useCallback } from "react";
import type { SSEEventType } from "@/types";

// eslint-disable-next-line
type SSEHandler<T = any> = (data: T, raw: MessageEvent) => void;
type HandlerMap = Partial<Record<SSEEventType | "ping", SSEHandler>>;

interface UseSSEOptions {
  channel?:    string;
  handlers:    HandlerMap;
  enabled?:    boolean;
}

export function useSSE({ channel = "global", handlers, enabled = true }: UseSSEOptions) {
  const esRef      = useRef<EventSource | null>(null);
  const retryRef   = useRef(0);
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlersRef = useRef(handlers);

  // Toujours lire les handlers les plus récents sans re-connecter
  useEffect(() => {
    handlersRef.current = handlers;
  });

  const connect = useCallback(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;

    const url = `/api/events?channel=${encodeURIComponent(channel)}`;
    const es  = new EventSource(url);
    esRef.current = es;

    es.onopen = () => {
      retryRef.current = 0; // Reset backoff on successful connection
    };

    // Écouter tous les types d'événements SSE nommés
    const eventTypes: Array<SSEEventType | "ping"> = [
      "ping",
      "vente.created",
      "vente.updated",
      "vente.annulee",
      "stock.updated",
      "stock.alert",
      "stock.alerte",
      "client.created",
      "client.updated",
      "produit.created",
      "produit.updated",
      "finance.updated",
    ];

    eventTypes.forEach((type) => {
      es.addEventListener(type, (e: MessageEvent) => {
        const handler = handlersRef.current[type];
        if (!handler) return;

        try {
          const parsed = JSON.parse(e.data);
          (handler as SSEHandler)(parsed?.data ?? parsed, e);
        } catch {
          // Ignorer les messages malformés
        }
      });
    });

    // Message générique (ping sans event-name)
    es.onmessage = (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data);
        if (parsed?.type === "ping") {
          handlersRef.current["ping"]?.(parsed, e);
        }
      } catch { /* */ }
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;

      // Backoff exponentiel : 1s → 2s → 4s → 8s → max 30s
      const delay = Math.min(1000 * 2 ** retryRef.current, 30_000);
      retryRef.current++;

      timerRef.current = setTimeout(() => {
        connect();
      }, delay);
    };
  }, [channel, enabled]);

  useEffect(() => {
    connect();

    return () => {
      esRef.current?.close();
      esRef.current = null;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [connect]);
}
