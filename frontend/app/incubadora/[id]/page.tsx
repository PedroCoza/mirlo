"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
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
type TranscripcionGuardada = {
  id: string;
  segmentos: unknown[];
  hablantes: string[] | null;
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
  const [fase, setFase] = useState<
    "transcribiendo" | "identificando" | "traduciendo" | null
  >(null);
  const [traducir, setTraducir] = useState(false);
  const [idioma, setIdioma] = useState("en");
  const [diarizar, setDiarizar] = useState(false);
  const [numHablantes, setNumHablantes] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [transcripcionExistente, setTranscripcionExistente] =
    useState<TranscripcionGuardada | null>(null);

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

  // Los contenidos de YouTube se descargan en segundo plano.
  useEffect(() => {
    if (contenido?.estado !== "descargando") return;
    const intervalo = setInterval(() => {
      fetch(`${API_URL}/biblioteca/contenido/${params.id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setContenido(d))
        .catch(() => {});
    }, 2000);
    return () => clearInterval(intervalo);
  }, [contenido, params.id]);

  // Si hay transcripción guardada (quizá editada), los procedimientos
  // posteriores se lanzan sobre ella sin repetir la transcripción.
  useEffect(() => {
    fetch(`${API_URL}/transcripciones/${params.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((t) => t && setTranscripcionExistente(t))
      .catch(() => {});
  }, [params.id]);

  const aplicarProcedimientos = async (
    transcripcionId: string,
    segmentosIniciales: unknown[],
  ) => {
    let segmentos = segmentosIniciales;

    if (diarizar) {
      setFase("identificando");
      const resDiar = await fetch(`${API_URL}/diarizar/${transcripcionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          numHablantes ? { num_hablantes: Number(numHablantes) } : {},
        ),
      });
      if (!resDiar.ok) {
        const err = await resDiar.json().catch(() => ({}));
        throw new Error(err.detail || "No se pudo identificar a los hablantes");
      }
      const diarizada = await resDiar.json();
      segmentos = diarizada.segmentos;
      sessionStorage.setItem(
        `mirlo-hablantes-${params.id}`,
        JSON.stringify(diarizada.hablantes),
      );
    }

    if (traducir) {
      setFase("traduciendo");
      const resTrad = await fetch(`${API_URL}/traducir/${transcripcionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idioma }),
      });
      if (!resTrad.ok) {
        const err = await resTrad.json().catch(() => ({}));
        throw new Error(err.detail || "No se pudo traducir");
      }
      const traduccion = await resTrad.json();
      sessionStorage.setItem(
        `mirlo-traduccion-${params.id}`,
        JSON.stringify(traduccion),
      );
    }

    return segmentos;
  };

  const lanzarProcesamiento = async () => {
    setFase("transcribiendo");
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
      let segmentos = data.segmentos;

      if (diarizar || traducir) {
        const guardado = await fetch(`${API_URL}/transcripciones`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contenido_id: params.id,
            segmentos,
          }),
        });
        if (!guardado.ok) {
          throw new Error("No se pudo guardar la transcripción");
        }
        const transcripcion = await guardado.json();
        segmentos = await aplicarProcedimientos(transcripcion.id, segmentos);
      }

      sessionStorage.setItem(
        `mirlo-transcripcion-${params.id}`,
        JSON.stringify(segmentos),
      );
      router.push(`/mirlo/${params.id}`);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo procesar el contenido",
      );
      setFase(null);
    }
  };

  const continuarProcesamiento = async () => {
    if (!transcripcionExistente) return;
    setError(null);
    try {
      if (!diarizar && !traducir) {
        router.push(`/mirlo/${params.id}`);
        return;
      }
      if (transcripcionExistente.hablantes?.length) {
        sessionStorage.setItem(
          `mirlo-hablantes-${params.id}`,
          JSON.stringify(transcripcionExistente.hablantes),
        );
      }
      const segmentos = await aplicarProcedimientos(
        transcripcionExistente.id,
        transcripcionExistente.segmentos,
      );
      sessionStorage.setItem(
        `mirlo-transcripcion-${params.id}`,
        JSON.stringify(segmentos),
      );
      router.push(`/mirlo/${params.id}`);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo procesar el contenido",
      );
      setFase(null);
    }
  };

  const yaProcesado =
    contenido !== null &&
    contenido.estado !== "pendiente" &&
    contenido.estado !== "descargando";

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

      <AvisoError mensaje={error} onCerrar={() => setError(null)} />

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
              {contenido.estado === "descargando" ? (
                <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 text-center">
                  <span className="animate-pulse text-3xl" aria-hidden>
                    ⬇
                  </span>
                  <p className="text-sm text-text-secondary">
                    Descargando el audio de YouTube…
                  </p>
                  <p className="text-xs text-text-secondary">
                    Podrás lanzar el procesamiento en cuanto termine.
                  </p>
                </div>
              ) : contenido.tipo === "video" ? (
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
            {contenido.estado !== "pendiente" && (
              <Link
                href={`/mirlo/${params.id}`}
                className="flex items-center justify-between rounded-xl border border-accent-secondary/40 bg-accent-secondary/10 px-4 py-2.5 text-sm font-medium text-accent-secondary"
              >
                <span>✓ Ya procesado</span>
                <span>Abrir →</span>
              </Link>
            )}
            <section className="rounded-2xl border border-border-c bg-bg-surface p-5">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-base font-semibold">Transcripción</h2>
                <span className="rounded-full bg-accent-secondary/15 px-2 py-0.5 text-xs font-medium text-accent-secondary">
                  {transcripcionExistente ? "Guardada" : "Disponible"}
                </span>
              </div>
              <p className="text-sm text-text-secondary">
                {transcripcionExistente
                  ? "Hay una transcripción guardada: los procedimientos se lanzan sobre ella sin repetir el cómputo."
                  : "WhisperX genera los segmentos con marcas de tiempo en el idioma original del audio."}
              </p>
              <div className="mt-4">
                <span className="rounded-full bg-bg-elevated px-2 py-0.5 text-xs text-text-secondary">
                  {contenido.estado === "descargando" && "⬇ Descargando"}
                  {contenido.estado === "pendiente" && "○ Pendiente"}
                  {contenido.estado === "procesado" && "🎙️ Transcrito"}
                  {contenido.estado === "traducido" && "🌐 Traducido"}
                </span>
              </div>
            </section>

            <section className="rounded-2xl border border-border-c bg-bg-surface p-5">
              <div className="mb-2 flex items-center justify-between">
                <h2
                  className={`text-base font-semibold ${traducir ? "" : "opacity-50"}`}
                >
                  Traducción
                </h2>
                <label
                  className="relative inline-flex cursor-pointer items-center"
                  title="Activar traducción"
                >
                  <input
                    type="checkbox"
                    checked={traducir}
                    onChange={(e) => setTraducir(e.target.checked)}
                    aria-label="Activar traducción"
                    className="peer sr-only"
                  />
                  <span className="h-5 w-9 rounded-full bg-bg-elevated transition-colors peer-checked:bg-accent-primary" />
                  <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-text-secondary transition-transform peer-checked:translate-x-4 peer-checked:bg-white" />
                </label>
              </div>
              <div
                className={`mt-3 flex items-center justify-between ${traducir ? "" : "opacity-50"}`}
              >
                <span className="text-sm text-text-secondary">
                  Idioma destino
                </span>
                <select
                  value={idioma}
                  onChange={(e) => setIdioma(e.target.value)}
                  disabled={!traducir}
                  className="rounded-lg border border-border-c bg-bg-elevated px-2 py-1.5 text-sm disabled:opacity-50"
                >
                  <option value="en">Inglés</option>
                  <option value="fr">Francés</option>
                  <option value="pt">Portugués</option>
                </select>
              </div>
              <p className="mt-3 text-xs text-text-secondary">
                Motor: LibreTranslate
              </p>
            </section>

            <section className="rounded-2xl border border-border-c bg-bg-surface p-5">
              <div className="mb-2 flex items-center justify-between">
                <h2
                  className={`text-base font-semibold ${diarizar ? "" : "opacity-50"}`}
                >
                  Identificación de hablantes
                </h2>
                <label
                  className="relative inline-flex cursor-pointer items-center"
                  title="Activar identificación de hablantes"
                >
                  <input
                    type="checkbox"
                    checked={diarizar}
                    onChange={(e) => setDiarizar(e.target.checked)}
                    aria-label="Activar identificación de hablantes"
                    className="peer sr-only"
                  />
                  <span className="h-5 w-9 rounded-full bg-bg-elevated transition-colors peer-checked:bg-accent-primary" />
                  <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-text-secondary transition-transform peer-checked:translate-x-4 peer-checked:bg-white" />
                </label>
              </div>
              <div
                className={`mt-3 flex items-center justify-between ${diarizar ? "" : "opacity-50"}`}
              >
                <span className="text-sm text-text-secondary">
                  Nº de hablantes
                </span>
                <input
                  type="number"
                  min={2}
                  max={10}
                  value={numHablantes}
                  onChange={(e) => setNumHablantes(e.target.value)}
                  disabled={!diarizar}
                  placeholder="Automático"
                  className="w-28 rounded-lg border border-border-c bg-bg-elevated px-2 py-1.5 text-sm disabled:opacity-50"
                />
              </div>
              <p className="mt-3 text-xs text-text-secondary">
                Motor: Pyannote 4
              </p>
            </section>

            <div>
              <button
                onClick={() =>
                  transcripcionExistente
                    ? continuarProcesamiento()
                    : yaProcesado
                      ? setConfirmando(true)
                      : lanzarProcesamiento()
                }
                disabled={fase !== null || contenido.estado === "descargando"}
                className="w-full cursor-pointer rounded-lg bg-accent-primary px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {contenido.estado === "descargando"
                  ? "Descargando audio…"
                  : fase === "transcribiendo"
                    ? "Transcribiendo…"
                    : fase === "identificando"
                      ? "Identificando…"
                      : fase === "traduciendo"
                        ? "Traduciendo…"
                        : transcripcionExistente
                          ? "▶ Continuar"
                          : "▶ Lanzar procesamiento"}
              </button>
              {transcripcionExistente && !fase && (
                <button
                  onClick={() => setConfirmando(true)}
                  className="mt-2 w-full cursor-pointer text-xs text-text-secondary hover:text-text-primary"
                >
                  Volver a transcribir desde cero
                </button>
              )}
              {fase && (
                <p className="mt-3 text-center text-xs text-accent-primary">
                  {fase === "traduciendo"
                    ? "Traduciendo los segmentos…"
                    : fase === "identificando"
                      ? "Identificando quién habla en cada segmento…"
                      : "Esto puede tardar unos segundos dependiendo de la duración…"}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {confirmando && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setConfirmando(false)}
        >
          <div
            className="mx-4 w-full max-w-md rounded-2xl border border-border-c bg-bg-surface p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-2 text-lg font-bold">Volver a procesar</h2>
            <p className="mb-4 text-sm text-text-secondary">
              Ya hay un resultado para este contenido: si vuelves a
              procesar, se sustituirá por uno nuevo.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setConfirmando(false);
                  lanzarProcesamiento();
                }}
                className="flex-1 rounded-lg bg-accent-primary px-4 py-2 text-sm font-medium text-white"
              >
                Procesar de nuevo
              </button>
              <button
                onClick={() => setConfirmando(false)}
                className="flex-1 rounded-lg border border-border-c px-4 py-2 text-sm text-text-secondary"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
