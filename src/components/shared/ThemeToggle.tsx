"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Évite le flash hydration
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="w-9 h-9" />;

  const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";

  const icons = {
    light:  <Sun  className="h-4 w-4" />,
    dark:   <Moon className="h-4 w-4" />,
    system: <Monitor className="h-4 w-4" />,
  };

  const labels = { light: "Clair", dark: "Sombre", system: "Système" };
  const current = (theme ?? "system") as "light" | "dark" | "system";

  return (
    <button
      onClick={() => setTheme(next)}
      title={`Mode ${labels[current]} — cliquer pour changer`}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors",
        "border border-border hover:bg-muted",
        theme === "dark" && "text-amber-400",
        theme === "light" && "text-blue-600",
      )}
    >
      {icons[current]}
      <span className="hidden sm:inline">{labels[current]}</span>
    </button>
  );
}
