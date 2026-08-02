"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Perfil = { id: string; nombre: string; avatar: string };

export default function Nido() {
  const router = useRouter();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    const activo = localStorage.getItem("mirlo-perfil-activo");
    if (activo) {
      setPerfil(JSON.parse(activo));
    }
    setListo(true);
  }, []);

  if (!listo) return null;

  // Sin perfil activo, vuelve al selector.
  if (!perfil) {
    router.replace("/perfiles");
    return null;
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-120px)] max-w-4xl flex-col gap-6 px-6 py-12">
      <div className="flex items-center gap-3">
        <span className="text-4xl" aria-hidden>
          {perfil.avatar}
        </span>
        <div>
          <h1 className="text-2xl font-bold">Nido de {perfil.nombre}</h1>
          <p className="text-sm text-text-secondary">
            Tu biblioteca de contenidos
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border-light bg-bg-surface p-12 text-center">
        <span className="text-5xl" aria-hidden>
          🪺
        </span>
        <p className="mt-4 text-lg font-medium text-text-secondary">
          El Nido está en construcción
        </p>
        <p className="mt-1 text-sm text-text-secondary">
          Aquí aparecerán tus contenidos de YouTube y archivos locales.
        </p>
      </div>

      <a
        href="/perfiles"
        className="mx-auto text-sm text-text-secondary hover:text-text-primary"
      >
        ← Cambiar de perfil
      </a>
    </main>
  );
}
