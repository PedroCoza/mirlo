"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type Perfil = { id: string; nombre: string; avatar: string };
type Contenido = {
  id: string;
  nombre: string;
  tipo: string;
  origen: string;
  estado: string;
  creado_en: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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

export default function Mirlo() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const perfil = useSyncExternalStore(
    suscribirStorage,
    leerPerfilLocal,
    () => null,
  );
  const hidratado = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const [contenido, setContenido] = useState<Contenido | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hidratado && !perfil) {
      router.replace("/perfiles");
    }
  }, [hidratado, perfil, router]);

  useEffect(() => {
    fetch(`${API_URL}/biblioteca/contenido/${params.id}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setContenido)
      .catch(() => setError("No se pudo cargar el contenido"));
  }, [params.id]);

  if (!perfil) return null;

  return (
    <main className="mx-auto flex min-h-[calc(100vh-120px)] max-w-3xl flex-col gap-6 px-6 py-12">
      <Link
        href={`/incubadora/${params.id}`}
        className="text-sm text-text-secondary hover:text-text-primary"
      >
        ← Volver a la Incubadora
      </Link>

      {error && (
        <div className="rounded-lg border border-youtube/40 bg-youtube/10 px-4 py-2 text-sm text-youtube">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Cerrar
          </button>
        </div>
      )}

      {contenido && (
        <div className="flex flex-col gap-3">
          <div>
            <h1 className="text-2xl font-bold">{contenido.nombre}</h1>
            <p className="text-sm text-text-secondary">
              {contenido.tipo === "audio" ? "Audio" : "Vídeo"} ·{" "}
              {new Date(contenido.creado_en).toLocaleDateString("es-ES")}
            </p>
          </div>
          <div className="rounded-2xl border border-border-c bg-bg-surface p-4">
            {contenido.tipo === "video" ? (
              <video
                src={`${API_URL}/biblioteca/archivo/${params.id}`}
                controls
                className="aspect-video w-full rounded-lg"
              />
            ) : (
              <audio
                src={`${API_URL}/biblioteca/archivo/${params.id}`}
                controls
                className="w-full"
              />
            )}
          </div>
        </div>
      )}
    </main>
  );
}
