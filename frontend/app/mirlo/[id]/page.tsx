"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
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
type Segmento = {
  start: number;
  end: number;
  text: string;
  modificado?: boolean;
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
  const [segmentos, setSegmentos] = useState<Segmento[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tiempoActual, setTiempoActual] = useState(0);
  const [autoSeguir, setAutoSeguir] = useState(true);
  const [editando, setEditando] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const listaRef = useRef<HTMLDivElement | null>(null);

  const reproductor = () => videoRef.current ?? audioRef.current;

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
      .then((c) => {
        setContenido(c);
        const raw = sessionStorage.getItem(
          `mirlo-transcripcion-${params.id}`,
        );
        if (raw) {
          try {
            setSegmentos(JSON.parse(raw));
          } catch {
            // transcripción corrupta en sessionStorage, se ignora
          }
        }
      })
      .catch(() => setError("No se pudo cargar el contenido"));
  }, [params.id]);

  const segmentoActivo =
    segmentos?.findIndex(
      (seg) => tiempoActual >= seg.start && tiempoActual < seg.end,
    ) ?? -1;

  const alActualizarTiempo = () => {
    const rep = reproductor();
    if (rep) {
      setTiempoActual(rep.currentTime);
    }
  };

  const saltarA = (t: number) => {
    const rep = reproductor();
    if (rep) {
      rep.currentTime = t;
      setTiempoActual(t);
    }
  };

  // Auto-follow: desplaza solo al cambiar de segmento y si no es visible.
  useEffect(() => {
    if (!autoSeguir || segmentoActivo < 0 || !listaRef.current) return;
    const el = listaRef.current.querySelector(
      `[data-seg="${segmentoActivo}"]`,
    ) as HTMLElement | null;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const contenedor = listaRef.current.getBoundingClientRect();
    const visible =
      rect.top >= contenedor.top && rect.bottom <= contenedor.bottom;
    if (!visible) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [autoSeguir, segmentoActivo]);

  const guardarSegmento = (i: number, texto: string) => {
    setEditando(null);
    const textoLimpio = texto.trim();
    setSegmentos((prev) => {
      if (!prev || prev[i].text === textoLimpio) return prev;
      const nuevos = [...prev];
      nuevos[i] = { ...nuevos[i], text: textoLimpio, modificado: true };
      return nuevos;
    });
  };

  const formatearTiempo = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  if (!perfil) return null;

  return (
    <main className="mx-auto flex min-h-[calc(100vh-120px)] max-w-6xl flex-col gap-6 px-6 py-12">
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
        <div className="grid flex-1 items-start gap-6 lg:grid-cols-[minmax(320px,2fr)_3fr]">
          {/* Reproductor */}
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
                  ref={videoRef}
                  src={`${API_URL}/biblioteca/archivo/${params.id}`}
                  controls
                  onTimeUpdate={alActualizarTiempo}
                  className="aspect-video w-full rounded-lg"
                />
              ) : (
                <audio
                  ref={audioRef}
                  src={`${API_URL}/biblioteca/archivo/${params.id}`}
                  controls
                  onTimeUpdate={alActualizarTiempo}
                  className="w-full"
                />
              )}
            </div>
          </div>

          {/* Lista de segmentos */}
          <div className="flex flex-col">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Transcripción</h2>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-text-secondary">
                <input
                  type="checkbox"
                  checked={autoSeguir}
                  onChange={(e) => setAutoSeguir(e.target.checked)}
                />
                Auto-seguir
              </label>
            </div>
            {segmentos === null ? (
              <p className="rounded-xl border border-dashed border-border-light bg-bg-surface p-6 text-sm text-text-secondary">
                No hay transcripción para este contenido.{" "}
                <Link
                  href={`/incubadora/${params.id}`}
                  className="text-accent-primary hover:underline"
                >
                  Genérala desde la Incubadora
                </Link>
                .
              </p>
            ) : (
              <div
                ref={listaRef}
                className="flex max-h-[calc(100vh-260px)] flex-col gap-1 overflow-y-auto rounded-2xl border border-border-c bg-bg-surface p-3"
              >
                {segmentos.map((seg, i) => (
                  <div
                    key={i}
                    data-seg={i}
                    onClick={() => saltarA(seg.start)}
                    onDoubleClick={() => setEditando(i)}
                    className={`group flex cursor-pointer gap-3 rounded-lg px-2 py-1.5 transition ${
                      i === segmentoActivo
                        ? "bg-accent-primary/10"
                        : "hover:bg-bg-elevated"
                    } ${seg.modificado ? "border-l-2 border-accent-primary" : ""}`}
                  >
                    <div className="flex shrink-0 flex-col items-center">
                      <span className="pt-0.5 font-mono text-xs text-text-secondary">
                        {formatearTiempo(seg.start)}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditando(i);
                        }}
                        aria-label="Editar segmento"
                        className="cursor-pointer opacity-0 transition hover:text-text-primary group-hover:opacity-100"
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="text-text-secondary"
                        >
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        </svg>
                      </button>
                    </div>
                    {editando === i ? (
                      <textarea
                        autoFocus
                        defaultValue={seg.text}
                        ref={(el) => {
                          if (el) {
                            el.style.height = "auto";
                            el.style.height = el.scrollHeight + "px";
                          }
                        }}
                        onBlur={(e) => guardarSegmento(i, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            e.currentTarget.blur();
                          }
                        }}
                        className="w-full resize-none rounded-lg border border-accent-primary/40 bg-bg-elevated px-2 py-1 text-sm leading-relaxed"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <p className="text-sm leading-relaxed">{seg.text}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
