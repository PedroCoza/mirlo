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

export default function Incubadora() {
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
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transcribiendo, setTranscribiendo] = useState(false);

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
      .catch(() => setError("No se pudo cargar el contenido"))
      .finally(() => setCargando(false));
  }, [params.id]);

  const transcribir = async () => {
    setTranscribiendo(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/transcribir/${params.id}`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "No se pudo transcribir");
      }
      const data = await res.json();
      sessionStorage.setItem(
        `mirlo-transcripcion-${params.id}`,
        JSON.stringify(data.segmentos),
      );
      router.push(`/mirlo/${params.id}`);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo transcribir el contenido",
      );
      setTranscribiendo(false);
    }
  };

  if (!perfil) return null;

  return (
    <main className="mx-auto flex min-h-[calc(100vh-120px)] max-w-5xl flex-col gap-6 px-6 py-12">
      <Link
        href="/nido"
        className="text-sm text-text-secondary hover:text-text-primary"
      >
        ← Volver al Nido
      </Link>

      {cargando && (
        <p className="text-sm text-text-secondary">Cargando contenido…</p>
      )}

      {error && (
        <div className="rounded-lg border border-youtube/40 bg-youtube/10 px-4 py-2 text-sm text-youtube">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Cerrar
          </button>
        </div>
      )}

      {contenido && (
        <div className="grid flex-1 items-start gap-6 lg:grid-cols-[1fr_360px]">
          {/* Izquierda: ficha del archivo + reproductor */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <span className="text-5xl" aria-hidden>
                {contenido.tipo === "audio" ? "🎵" : "🎬"}
              </span>
              <div>
                <h1 className="text-2xl font-bold">{contenido.nombre}</h1>
                <p className="text-sm text-text-secondary">
                  {contenido.tipo === "audio" ? "Audio" : "Vídeo"} · subido el{" "}
                  {new Date(contenido.creado_en).toLocaleDateString("es-ES")}
                </p>
              </div>
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

          {/* Derecha: panel de configuración del procesamiento */}
          <div className="flex flex-col gap-4">
            <section className="rounded-2xl border border-border-c bg-bg-surface p-5">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-base font-semibold">Transcripción</h2>
                <span className="rounded-full bg-accent-secondary/15 px-2 py-0.5 text-xs font-medium text-accent-secondary">
                  Disponible
                </span>
              </div>
              <p className="text-sm text-text-secondary">
                WhisperX genera los segmentos con marcas de tiempo en el idioma
                original del audio.
              </p>
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={transcribir}
                  disabled={transcribiendo}
                  className="rounded-lg bg-accent-primary px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {transcribiendo ? "Transcribiendo…" : "▶ Transcribir"}
                </button>
                <span className="rounded-full bg-bg-elevated px-2 py-0.5 text-xs text-text-secondary">
                  {contenido.estado === "pendiente" && "○ Pendiente"}
                  {contenido.estado === "procesado" && "✓ Hecho"}
                  {contenido.estado === "traducido" && "🌐 Traducido"}
                </span>
              </div>
              {transcribiendo && (
                <p className="mt-3 text-xs text-accent-primary">
                  Esto puede tardar unos segundos dependiendo de la duración…
                </p>
              )}
            </section>

          </div>
        </div>
      )}
    </main>
  );
}
