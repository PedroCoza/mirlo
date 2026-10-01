"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

type Perfil = { id: string; nombre: string; avatar: string };

let _rawCache: string | null | undefined;
let _perfilCache: Perfil | null = null;

function leerPerfilLocal(): Perfil | null {
  const raw = localStorage.getItem("mirlo-perfil-activo");
  if (raw === _rawCache) return _perfilCache;
  _rawCache = raw;
  try {
    _perfilCache = raw ? JSON.parse(raw) : null;
  } catch {
    _perfilCache = null;
  }
  return _perfilCache;
}

function suscribirStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

// La configuración (modelo, token de HuggingFace...) se guarda en el
// perfil activo: sin perfil no hay nada que configurar.
export function EnlaceConfig() {
  const perfil = useSyncExternalStore(
    suscribirStorage,
    leerPerfilLocal,
    () => null,
  );
  if (!perfil) return null;
  return (
    <Link
      href="/configuracion"
      aria-label="Configuración"
      title="Configuración"
      className="rounded-lg border border-border-c bg-bg-surface px-3 py-2 text-sm text-text-secondary transition hover:bg-bg-elevated hover:text-text-primary"
    >
      ⚙
    </Link>
  );
}
