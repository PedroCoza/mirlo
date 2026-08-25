"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import AvisoError from "../../componentes/aviso-error";

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
  const [historial, setHistorial] = useState<Segmento[][]>([]);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const listaRef = useRef<HTMLDivElement | null>(null);
  const edicionRef = useRef<HTMLTextAreaElement | null>(null);

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
        // Si la BD no tiene transcripción, default a la de sessionStorage.
        const cargarLocal = () => {
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
        };
        fetch(`${API_URL}/transcripciones/${params.id}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((t) => {
            if (t?.segmentos) {
              setSegmentos(t.segmentos);
            } else {
              cargarLocal();
            }
          })
          .catch(cargarLocal);
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

  const hayCambios = segmentos?.some((s) => s.modificado) ?? false;

  const guardarTranscripcion = async () => {
    if (!segmentos) return;
    setGuardando(true);
    try {
      const res = await fetch(`${API_URL}/transcripciones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contenido_id: params.id,
          segmentos: segmentos.map((s) => ({
            start: s.start,
            end: s.end,
            text: s.text,
          })),
        }),
      });
      if (!res.ok) throw new Error();
      setSegmentos((prev) =>
        prev ? prev.map((s) => ({ ...s, modificado: false })) : prev,
      );
      setGuardado(true);
      setTimeout(() => setGuardado(false), 3000);
    } catch {
      setError("No se pudo guardar la transcripción");
    } finally {
      setGuardando(false);
    }
  };

  const exportar = async (formato: string) => {
    try {
      const res = await fetch(
        `${API_URL}/exportar/${params.id}?formato=${formato}`,
      );
      if (!res.ok) {
        throw new Error("Guarda la transcripción antes de exportar");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const base = (contenido?.nombre ?? "transcripcion").split(".")[0];
      a.download = `${base}.${formato}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo exportar");
    }
  };

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

  const aplicar = (nuevos: Segmento[]) => {
    if (segmentos) setHistorial((h) => [...h.slice(-19), segmentos]);
    setSegmentos(nuevos);
  };

  const deshacer = () => {
    if (!historial.length) return;
    setSegmentos(historial[historial.length - 1]);
    setHistorial(historial.slice(0, -1));
  };

  const dividirSegmento = (i: number) => {
    const caja = edicionRef.current;
    if (!segmentos || !caja) return;
    const seg = segmentos[i];
    const texto = caja.value;
    const pos = caja.selectionStart;
    if (pos <= 0 || pos >= texto.length) return;

    const dentro = tiempoActual > seg.start && tiempoActual < seg.end;
    const corte = dentro
      ? tiempoActual
      : seg.start + (seg.end - seg.start) * (pos / texto.length);

    const nuevos = [...segmentos];
    nuevos.splice(
      i,
      1,
      {
        start: seg.start,
        end: corte,
        text: texto.slice(0, pos).trim(),
        modificado: true,
      },
      {
        start: corte,
        end: seg.end,
        text: texto.slice(pos).trim(),
        modificado: true,
      },
    );
    setEditando(null);
    aplicar(nuevos);
  };

  const fusionarConSiguiente = (i: number) => {
    if (!segmentos || i >= segmentos.length - 1) return;
    const actual = segmentos[i];
    const siguiente = segmentos[i + 1];
    const nuevos = [...segmentos];
    nuevos.splice(i, 2, {
      start: actual.start,
      end: siguiente.end,
      text: [actual.text, siguiente.text].filter(Boolean).join(" "),
      modificado: true,
    });
    aplicar(nuevos);
  };

  const formatearTiempo = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  if (!perfil) return null;

  return (
    <main className="mx-auto flex min-h-[calc(100vh-120px)] max-w-6xl flex-col gap-6 px-6 py-12">
      <div className="flex items-center justify-between">
        <Link
          href="/nido"
          className="text-sm text-text-secondary hover:text-text-primary"
        >
          ← Volver al Nido
        </Link>
        <Link
          href={`/incubadora/${params.id}`}
          className="text-sm text-text-secondary hover:text-accent-primary"
        >
          ⚙ Reprocesar
        </Link>
      </div>

      <AvisoError mensaje={error} onCerrar={() => setError(null)} />

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
              <>
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
                    className={`group flex cursor-pointer flex-col rounded-lg px-2 py-1.5 transition ${
                      i === segmentoActivo
                        ? "bg-accent-primary/10"
                        : "hover:bg-bg-elevated"
                    } ${seg.modificado ? "border-l-2 border-accent-primary" : ""}`}
                  >
                    <div className="flex gap-3">
                      <span className="shrink-0 pt-0.5 font-mono text-xs text-text-secondary">
                        {formatearTiempo(seg.start)}
                      </span>
                      {editando === i ? (
                        <textarea
                          autoFocus
                          defaultValue={seg.text}
                          ref={(el) => {
                            edicionRef.current = el;
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
                    <div className="mt-1 flex justify-end gap-1.5 opacity-0 transition group-hover:opacity-100">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditando(i);
                        }}
                        aria-label="Editar segmento"
                        className="cursor-pointer text-text-secondary hover:text-text-primary"
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
                        >
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        </svg>
                      </button>
                      <button
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          dividirSegmento(i);
                        }}
                        disabled={editando !== i}
                        aria-label="Dividir por el cursor"
                        title={
                          editando === i
                            ? "Dividir el segmento por donde está el cursor"
                            : "Edita el segmento y coloca el cursor para dividir"
                        }
                        className="cursor-pointer text-text-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30"
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
                        >
                          <circle cx="6" cy="6" r="3" />
                          <circle cx="6" cy="18" r="3" />
                          <line x1="20" y1="4" x2="8.12" y2="15.88" />
                          <line x1="14.47" y1="14.48" x2="20" y2="20" />
                          <line x1="8.12" y1="8.12" x2="12" y2="12" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          fusionarConSiguiente(i);
                        }}
                        disabled={i === segmentos.length - 1}
                        aria-label="Fusionar con el siguiente"
                        title="Fusionar con el siguiente"
                        className="cursor-pointer text-text-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30"
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
                        >
                          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2">
                {hayCambios && (
                  <button
                    onClick={guardarTranscripcion}
                    disabled={guardando}
                    className="rounded-lg bg-accent-primary px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {guardando ? "Guardando…" : "Guardar cambios"}
                  </button>
                )}
                {historial.length > 0 && (
                  <button
                    onClick={deshacer}
                    title="Deshacer la última división o fusión"
                    className="rounded-lg border border-border-c px-3 py-1.5 text-sm text-text-secondary hover:border-accent-primary hover:text-accent-primary"
                  >
                    ↶ Deshacer
                  </button>
                )}
                {guardado && (
                  <span className="text-sm text-accent-secondary">
                    ✓ Guardado
                  </span>
                )}
              </div>
              {segmentos && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-text-secondary">
                    Descargar:
                  </span>
                  {(["srt", "vtt", "txt", "json"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => exportar(f)}
                      className="rounded-lg border border-border-c px-2.5 py-1 text-xs font-medium uppercase text-text-secondary hover:border-accent-primary hover:text-accent-primary"
                    >
                      {f}
                    </button>
                  ))}
                </div>
              )}
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
