"use client";

import { useTheme } from "./theme-provider";

export function ThemeSwitch() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label="Cambiar tema"
      className="rounded-lg border border-border-c bg-bg-surface px-3 py-2 text-sm text-text-secondary transition hover:bg-bg-elevated hover:text-text-primary"
    >
      {theme === "dark" ? "☀️ Claro" : "🌙 Oscuro"}
    </button>
  );
}
