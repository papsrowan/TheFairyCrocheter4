// ─────────────────────────────────────────────────────────────────────────────
// SSE EVENT EMITTER — Synchronisation temps réel via Server-Sent Events
// Pattern : EventEmitter partagé en mémoire sur le VPS (process unique)
// ─────────────────────────────────────────────────────────────────────────────

import { EventEmitter } from "events";
import type { SSEEvent, SSEEventType } from "@/types";

// Singleton partagé dans le process Node.js
const globalForSSE = globalThis as unknown as {
  sseEmitter: EventEmitter | undefined;
};

export const sseEmitter =
  globalForSSE.sseEmitter ??
  (() => {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(500); // Support de 500 clients simultanés
    return emitter;
  })();

if (process.env.NODE_ENV !== "production") {
  globalForSSE.sseEmitter = sseEmitter;
}

/**
 * Émet un événement SSE vers tous les clients connectés au dashboard
 */
export function emitSSE<T = unknown>(
  type: SSEEventType,
  data: T,
  channel = "global"
): void {
  const event: SSEEvent<T> = {
    type,
    data,
    timestamp: new Date().toISOString(),
  };

  sseEmitter.emit(channel, event);
}

/**
 * Crée un stream SSE pour une connexion client
 * Retourne un ReadableStream compatible avec l'API Web Streams
 */
export function createSSEStream(channel = "global"): ReadableStream {
  let listener: (event: SSEEvent) => void;

  return new ReadableStream({
    start(controller) {
      // Ping initial pour confirmer la connexion
      const pingMessage = `data: ${JSON.stringify({ type: "ping", timestamp: new Date().toISOString() })}\n\n`;
      controller.enqueue(new TextEncoder().encode(pingMessage));

      // Abonner au canal SSE
      listener = (event: SSEEvent) => {
        try {
          const message = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(new TextEncoder().encode(message));
        } catch {
          // Le client s'est déconnecté
          sseEmitter.off(channel, listener);
        }
      };

      sseEmitter.on(channel, listener);

      // Ping toutes les 30s pour maintenir la connexion ouverte
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({ type: "ping" })}\n\n`
            )
          );
        } catch {
          clearInterval(pingInterval);
          sseEmitter.off(channel, listener);
        }
      }, 30_000);
    },

    cancel() {
      // Nettoyage quand le client se déconnecte
      if (listener) {
        sseEmitter.off(channel, listener);
      }
    },
  });
}
