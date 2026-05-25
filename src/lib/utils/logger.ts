// ─────────────────────────────────────────────────────────────────────────────
// LOGGER — Pino avec logs structurés JSON pour audit externe
// ─────────────────────────────────────────────────────────────────────────────

import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  ...(process.env.NODE_ENV === "development"
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        },
      }
    : {
        // Production : JSON structuré pour collecte externe
        formatters: {
          level: (label: string) => ({ level: label }),
        },
        timestamp: pino.stdTimeFunctions.isoTime,
        base: {
          service: "gestion-commerciale",
          env: process.env.NODE_ENV,
        },
      }),
});
