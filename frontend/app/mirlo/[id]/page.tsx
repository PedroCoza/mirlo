"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import AvisoError from "../../componentes/aviso-error";
import Tabs from "../../componentes/tabs";

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
  hablante?: string | null;
  modificado?: boolean;
};
type TraduccionData = {
  idioma: string;
  segmentos: { start: number; end: number; text: string }[];
};

const NOMBRE_IDIOMA: Record<string, string> = {
  en: "Inglés",
  fr: "Francés",
  pt: "Portugués",
};

const COLORES_HABLANTE = [
  "#4f8ef7",
  "#4fc37a",
  "#c77bd6",
  "#e0b64f",
  "#4fc3c9",
  "#e06a5a",
];

function etiquetaHablante(nombre: string) {
  return nombre.startsWith("SPEAKER_")
    ? nombre.slice(-2)
    : nombre.slice(0, 2).toUpperCase();
}

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
  const [duracionAudio, setDuracionAudio] = useState(0);
  const [autoSeguir, setAutoSeguir] = useState(true);
  const [editando, setEditando] = useState<number | null>(null);
  const [renombrando, setRenombrando] = useState<string | null>(null);
  const [fusionando, setFusionando] = useState<string | null>(null);
  const [historial, setHistorial] = useState<Segmento[][]>([]);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [tab, setTab] = useState<
    "transcripcion" | "traduccion" | "diarizacion"
  >("transcripcion");
  const [traduccion, setTraduccion] = useState<TraduccionData | null>(null);
  const [vistaTraduccion, setVistaTraduccion] = useState<
    "original" | "traduccion" | "ambos"
  >("ambos");
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
              fetch(`${API_URL}/traducciones/${t.id}`)
                .then((r) => (r.ok ? r.json() : null))
                .then((tr) => {
                  if (tr?.segmentos) setTraduccion(tr);
                })
                .catch(() => {});
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

  const hablantes = [
    ...new Set(
      segmentos?.flatMap((s) => (s.hablante ? [s.hablante] : [])) ?? [],
    ),
  ].sort();

  const colorHablante = (nombre: string) =>
    COLORES_HABLANTE[
      Math.max(0, hablantes.indexOf(nombre)) % COLORES_HABLANTE.length
    ];

  const duracion =
    duracionAudio ||
    (segmentos?.length ? segmentos[segmentos.length - 1].end : 0);

  const repartoHablantes = hablantes.map((h) => {
    const propios = segmentos?.filter((s) => s.hablante === h) ?? [];
    const total = propios.reduce((acc, s) => acc + (s.end - s.start), 0);
    return {
      nombre: h,
      segmentos: propios.length,
      tiempo: total,
      porcentaje: duracion ? (total / duracion) * 100 : 0,
    };
  });

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
            hablante: s.hablante,
          })),
          hablantes: hablantes.length ? hablantes : undefined,
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
      const vista = tab === "traduccion" ? vistaTraduccion : "original";
      const res = await fetch(
        `${API_URL}/exportar/${params.id}?formato=${formato}&vista=${vista}`,
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

  const renombrarHablante = (anterior: string, nuevo: string) => {
    const limpio = nuevo.trim();
    setRenombrando(null);
    if (!limpio || limpio === anterior || !segmentos) return;
    aplicar(
      segmentos.map((s) =>
        s.hablante === anterior
          ? { ...s, hablante: limpio, modificado: true }
          : s,
      ),
    );
  };

  const fusionarHablantes = (absorbido: string, destino: string) => {
    setFusionando(null);
    if (!segmentos) return;
    aplicar(
      segmentos.map((s) =>
        s.hablante === absorbido
          ? { ...s, hablante: destino, modificado: true }
          : s,
      ),
    );
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
        <>
          <div>
            <h1 className="text-2xl font-bold">{contenido.nombre}</h1>
            <p className="text-sm text-text-secondary">
              {contenido.tipo === "audio" ? "Audio" : "Vídeo"} ·{" "}
              {new Date(contenido.creado_en).toLocaleDateString("es-ES")}
              {traduccion &&
                ` · 🌐 ${NOMBRE_IDIOMA[traduccion.idioma] ?? traduccion.idioma}`}
            </p>
          </div>

          <div className="rounded-2xl border border-border-c bg-bg-surface p-4">
            {contenido.tipo === "video" ? (
              <video
                ref={videoRef}
                src={`${API_URL}/biblioteca/archivo/${params.id}`}
                controls
                onTimeUpdate={alActualizarTiempo}
                onLoadedMetadata={(e) =>
                  setDuracionAudio(e.currentTarget.duration)
                }
                className="aspect-video max-h-[45vh] w-full rounded-lg object-contain"
              />
            ) : (
              <audio
                ref={audioRef}
                src={`${API_URL}/biblioteca/archivo/${params.id}`}
                controls
                onTimeUpdate={alActualizarTiempo}
                onLoadedMetadata={(e) =>
                  setDuracionAudio(e.currentTarget.duration)
                }
                className="w-full"
              />
            )}
          </div>

          <Tabs
            tabs={[
              { id: "transcripcion", etiqueta: "📝 Transcripción" },
              { id: "traduccion", etiqueta: "🌐 Traducción" },
              { id: "diarizacion", etiqueta: "👥 Diarización" },
            ]}
            activa={tab}
            onCambiar={(id) =>
              setTab(id as "transcripcion" | "traduccion" | "diarizacion")
            }
          />

          {tab === "transcripcion" && (
          <div className="flex flex-1 flex-col">
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
                className="flex max-h-[45vh] flex-col gap-1 overflow-y-auto rounded-2xl border border-border-c bg-bg-surface p-3"
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
                    title="Deshacer el último cambio"
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
          )}

          {tab === "traduccion" && (
            <div className="flex flex-1 flex-col">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex gap-1">
                  {(["original", "traduccion", "ambos"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setVistaTraduccion(v)}
                      className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-medium ${
                        vistaTraduccion === v
                          ? "bg-accent-primary/20 text-accent-primary"
                          : "text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      {v === "original"
                        ? "Original"
                        : v === "traduccion"
                          ? "Traducción"
                          : "Ambos"}
                    </button>
                  ))}
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-text-secondary">
                  <input
                    type="checkbox"
                    checked={autoSeguir}
                    onChange={(e) => setAutoSeguir(e.target.checked)}
                  />
                  Auto-seguir
                </label>
              </div>

              {!traduccion ? (
                <p className="rounded-xl border border-dashed border-border-light bg-bg-surface p-6 text-sm text-text-secondary">
                  No hay traducción para este contenido.{" "}
                  <Link
                    href={`/incubadora/${params.id}`}
                    className="text-accent-primary hover:underline"
                  >
                    Actívala en la Incubadora
                  </Link>{" "}
                  al procesar.
                </p>
              ) : (
                <>
                  <div
                    ref={listaRef}
                    className="flex max-h-[45vh] flex-col gap-1 overflow-y-auto rounded-2xl border border-border-c bg-bg-surface p-3"
                  >
                    <div
                      className={`grid gap-x-4 border-b border-border-c px-2 pb-2 text-xs font-medium text-text-secondary ${
                        vistaTraduccion === "ambos"
                          ? "grid-cols-[64px_1fr_1fr]"
                          : "grid-cols-[64px_1fr]"
                      }`}
                    >
                      <span />
                      {vistaTraduccion !== "traduccion" && <span>Original</span>}
                      {vistaTraduccion !== "original" && (
                        <span>
                          {NOMBRE_IDIOMA[traduccion.idioma] ??
                            traduccion.idioma}{" "}
                          (traducido)
                        </span>
                      )}
                    </div>
                    {segmentos?.map((seg, i) => (
                      <div
                        key={i}
                        data-seg={i}
                        onClick={() => saltarA(seg.start)}
                        className={`grid cursor-pointer gap-x-4 rounded-lg px-2 py-1.5 transition ${
                          vistaTraduccion === "ambos"
                            ? "grid-cols-[64px_1fr_1fr]"
                            : "grid-cols-[64px_1fr]"
                        } ${
                          i === segmentoActivo
                            ? "bg-accent-primary/10"
                            : "hover:bg-bg-elevated"
                        }`}
                      >
                        <span className="pt-0.5 font-mono text-xs text-text-secondary">
                          {formatearTiempo(seg.start)}
                        </span>
                        {vistaTraduccion !== "traduccion" && (
                          <p className="text-sm leading-relaxed">{seg.text}</p>
                        )}
                        {vistaTraduccion !== "original" && (
                          <p className="text-sm leading-relaxed">
                            {traduccion.segmentos[i]?.text ?? "—"}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-text-secondary">
                      Descargar:
                    </span>
                    {(["srt", "vtt", "txt", "json"] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => exportar(f)}
                        className="cursor-pointer rounded-lg border border-border-c px-2.5 py-1 text-xs font-medium uppercase text-text-secondary hover:border-accent-primary hover:text-accent-primary"
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {tab === "diarizacion" && (
            <div className="flex flex-1 flex-col">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">
                    Transcripción con hablantes
                  </h2>
                  {hablantes.length > 0 && (
                    <p className="text-xs text-text-secondary">
                      {segmentos?.length ?? 0} segmentos ·{" "}
                      {hablantes.length} hablantes
                    </p>
                  )}
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-text-secondary">
                  <input
                    type="checkbox"
                    checked={autoSeguir}
                    onChange={(e) => setAutoSeguir(e.target.checked)}
                  />
                  Auto-seguir
                </label>
              </div>

              {hablantes.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border-light bg-bg-surface p-6 text-sm text-text-secondary">
                  No hay hablantes identificados para este contenido.{" "}
                  <Link
                    href={`/incubadora/${params.id}`}
                    className="text-accent-primary hover:underline"
                  >
                    Actívalo en la Incubadora
                  </Link>{" "}
                  al procesar.
                </p>
              ) : (
                <>
                  <div className="grid flex-1 items-start gap-4 lg:grid-cols-[1fr_240px]">
                  <div className="flex min-w-0 flex-col">
                  <div className="mb-3 rounded-2xl border border-border-c bg-bg-surface p-3">
                    <div className="flex flex-col gap-1.5">
                      {hablantes.map((h) => (
                        <div key={h} className="flex items-center gap-2">
                          <span
                            title={h}
                            style={{ backgroundColor: colorHablante(h) }}
                            className="h-4 w-4 shrink-0 rounded-full text-center text-[9px] font-bold leading-4 text-white"
                          >
                            {etiquetaHablante(h)}
                          </span>
                          <div className="relative h-5 flex-1 overflow-hidden rounded bg-bg-elevated">
                            {segmentos
                              ?.filter((s) => s.hablante === h)
                              .map((s, j) => (
                                <button
                                  key={j}
                                  onClick={() => saltarA(s.start)}
                                  title={`${formatearTiempo(s.start)} · ${h}`}
                                  style={{
                                    left: `${(s.start / duracion) * 100}%`,
                                    width: `${Math.max(((s.end - s.start) / duracion) * 100, 0.4)}%`,
                                    backgroundColor: colorHablante(h),
                                  }}
                                  className="absolute inset-y-0.5 cursor-pointer rounded-sm hover:opacity-80"
                                />
                              ))}
                            {duracion > 0 && (
                              <span
                                style={{
                                  left: `${(tiempoActual / duracion) * 100}%`,
                                }}
                                className="pointer-events-none absolute inset-y-0 w-0.5 bg-text-primary"
                              />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-1.5 flex justify-between pl-6 font-mono text-[10px] text-text-secondary">
                      <span>00:00</span>
                      <span>{formatearTiempo(duracion)}</span>
                    </div>
                  </div>

                  <div
                    ref={listaRef}
                    className="flex max-h-[45vh] flex-col gap-1 overflow-y-auto rounded-2xl border border-border-c bg-bg-surface p-3"
                  >
                    {segmentos?.map((seg, i) => (
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
                        <span
                          title={seg.hablante ?? "Sin asignar"}
                          style={{
                            backgroundColor: seg.hablante
                              ? colorHablante(seg.hablante)
                              : "#555",
                          }}
                          className="mt-0.5 h-5 w-5 shrink-0 rounded-full text-center text-[10px] font-bold leading-5 text-white"
                        >
                          {seg.hablante ? etiquetaHablante(seg.hablante) : "—"}
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
                            title="Editar el texto del segmento"
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
                            disabled={i === (segmentos?.length ?? 0) - 1}
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
                        title="Deshacer el último cambio"
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

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-text-secondary">
                      Descargar:
                    </span>
                    {(["srt", "vtt", "txt", "json"] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => exportar(f)}
                        className="cursor-pointer rounded-lg border border-border-c px-2.5 py-1 text-xs font-medium uppercase text-text-secondary hover:border-accent-primary hover:text-accent-primary"
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                  </div>
                  <aside className="flex flex-col rounded-2xl border border-border-c bg-bg-surface p-4">
                    <h3 className="text-sm font-semibold">Hablantes</h3>
                    {repartoHablantes.map((h) => (
                      <div key={h.nombre} className="mt-4">
                        <div className="flex items-center gap-2">
                          <span
                            title={h.nombre}
                            style={{
                              backgroundColor: colorHablante(h.nombre),
                            }}
                            className="h-4 w-4 shrink-0 rounded-full text-center text-[9px] font-bold leading-4 text-white"
                          >
                            {etiquetaHablante(h.nombre)}
                          </span>
                          {renombrando === h.nombre ? (
                            <input
                              autoFocus
                              defaultValue={h.nombre}
                              onBlur={(e) =>
                                renombrarHablante(h.nombre, e.target.value)
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  e.currentTarget.blur();
                                }
                                if (e.key === "Escape") {
                                  setRenombrando(null);
                                }
                              }}
                              className="min-w-0 flex-1 rounded-lg border border-accent-primary/40 bg-bg-elevated px-2 py-1 text-sm"
                            />
                          ) : (
                            <button
                              onClick={() => setRenombrando(h.nombre)}
                              title="Renombrar hablante"
                              className="truncate text-sm font-medium hover:text-accent-primary"
                            >
                              {h.nombre}
                            </button>
                          )}
                        </div>
                        <div className="mt-1.5 flex justify-between text-xs text-text-secondary">
                          <span>{h.segmentos} segmentos</span>
                          <span>
                            {Math.round(h.porcentaje)}% ·{" "}
                            {formatearTiempo(h.tiempo)}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-bg-elevated">
                          <div
                            style={{
                              width: `${h.porcentaje}%`,
                              backgroundColor: colorHablante(h.nombre),
                            }}
                            className="h-full rounded-full"
                          />
                        </div>
                        {fusionando === h.nombre ? (
                          <select
                            autoFocus
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value) {
                                fusionarHablantes(h.nombre, e.target.value);
                              } else {
                                setFusionando(null);
                              }
                            }}
                            onBlur={() => setFusionando(null)}
                            className="mt-2 w-full rounded-lg border border-border-c bg-bg-elevated px-2 py-1 text-xs"
                          >
                            <option value="" disabled>
                              Fusionar con…
                            </option>
                            {hablantes
                              .filter((o) => o !== h.nombre)
                              .map((o) => (
                                <option key={o} value={o}>
                                  {o}
                                </option>
                              ))}
                          </select>
                        ) : (
                          <button
                            onClick={() => setFusionando(h.nombre)}
                            disabled={hablantes.length < 2}
                            title="Fusionar este hablante con otro"
                            className="mt-2 cursor-pointer text-xs text-text-secondary hover:text-accent-primary disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            🔗 Fusionar
                          </button>
                        )}
                      </div>
                    ))}
                  </aside>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}
