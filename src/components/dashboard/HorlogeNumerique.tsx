"use client";

import { useState, useEffect } from "react";

export function HorlogeNumerique() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) return null;

  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const date = now.toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  const blink = now.getSeconds() % 2 === 0;

  return (
    <div className="card p-5 text-center select-none">
      {/* Affichage LED */}
      <div
        className="inline-flex items-center gap-1 rounded-xl px-5 py-3 mb-3"
        style={{ background: "linear-gradient(135deg, #0f172a, #1e293b)", fontFamily: "'Courier New', monospace" }}
      >
        {[hh, mm, ss].map((unit, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && (
              <span
                className="text-2xl font-bold transition-opacity duration-100"
                style={{ color: "#f59e0b", opacity: blink ? 1 : 0.2 }}
              >:
              </span>
            )}
            {unit.split("").map((digit, j) => (
              <span
                key={j}
                className="inline-block text-3xl font-bold tabular-nums w-8 text-center"
                style={{ color: i === 2 ? "#6ee7b7" : "#f59e0b", textShadow: `0 0 10px ${i === 2 ? "#6ee7b7" : "#f59e0b"}88` }}
              >
                {digit}
              </span>
            ))}
          </span>
        ))}
      </div>

      <p className="text-xs text-muted-foreground capitalize">{date}</p>
    </div>
  );
}
