"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Perfil = { id: string; nombre: string; avatar: string };
type VideoYouTube = { id: string; titulo: string; thumbnail: string };
type Contenido = {
  id: string;
  nombre: string;
  tipo: string;
  origen: string;
  estado: string;
  creado_en: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function leerPerfilLocal(): Perfil | null {
  try {
    const activo = localStorage.getItem("mirlo-perfil-activo");
    return activo ? JSON.parse(activo) : null;
  } catch {
    return null;
  }
}

function suscribirStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

export default function Nido() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const perfil = useSyncExternalStore(
    suscribirStorage,
    leerPerfilLocal,
    () => null
  );
  const [tab, setTab] = useState<"biblioteca" | "youtube">(
    searchParams.get("youtube") === "conectado" ? "youtube" : "biblioteca"
  );
  const [youtubeConectado, setYoutubeConectado] = useState(
    searchParams.get("youtube") === "conectado"
  );
  const [videos, setVideos] = useState<VideoYouTube[]>([]);
  const [cargandoYoutube, setCargandoYoutube] = useState(false);
  const [errorYoutube, setErrorYoutube] = useState<string | null>(null);
  const [descargando, setDescargando] = useState<string | null>(null);
  const [archivos, setArchivos] = useState<Contenido[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [errorBiblioteca, setErrorBiblioteca] = useState<string | null>(null);
  const [modalSubida, setModalSubida] = useState(false);

  // Sin perfil activo, redirige al selector.
  useEffect(() => {
    if (!perfil) {
      router.replace("/perfiles");
    }
  }, [perfil, router]);

  // Comprueba el estado de conexión de YouTube al cargar.
  useEffect(() => {
    if (!perfil) return;
    fetch(`${API_URL}/youtube/conectado?perfil_id=${perfil.id}`)
      .then((r) => r.json())
      .then((d) => setYoutubeConectado(d.conectado))
      .catch(() => {});
  }, [perfil]);

  // Carga la biblioteca local del perfil.
  useEffect(() => {
    if (!perfil) return;
    fetch(`${API_URL}/biblioteca/${perfil.id}`)
      .then((r) => r.json())
      .then(setArchivos)
      .catch(() => {});
  }, [perfil]);

  const subirArchivo = async (file: File) => {
    if (!perfil) return;
    setSubiendo(true);
    setErrorBiblioteca(null);
    try {
      const form = new FormData();
      form.append("archivo", file);
      const res = await fetch(
        `${API_URL}/biblioteca/subir?perfil_id=${perfil.id}`,
        { method: "POST", body: form }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Error al subir");
      }
      const nuevo = await res.json();
      setArchivos((prev) => [nuevo, ...prev]);
      setModalSubida(false);
    } catch (e) {
      setErrorBiblioteca(e instanceof Error ? e.message : "No se pudo subir el archivo");
    } finally {
      setSubiendo(false);
    }
  };

  const eliminarArchivo = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/biblioteca/contenido/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setArchivos((prev) => prev.filter((a) => a.id !== id));
    } catch {
      setErrorBiblioteca("No se pudo eliminar el archivo");
    }
  };

  const cargarVideos = () => {
    if (!perfil) return;
    setCargandoYoutube(true);
    setErrorYoutube(null);
    fetch(`${API_URL}/youtube/videos?perfil_id=${perfil.id}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => setVideos(d))
      .catch(() => setErrorYoutube("No se pudieron cargar los vídeos"))
      .finally(() => setCargandoYoutube(false));
  };

  const conectarYoutube = () => {
    if (!perfil) return;
    window.location.href = `${API_URL}/youtube/auth?perfil_id=${perfil.id}`;
  };

  const descargarVideo = async (videoId: string) => {
    if (!perfil) return;
    setDescargando(videoId);
    try {
      const res = await fetch(`${API_URL}/youtube/descargar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_id: videoId, perfil_id: perfil.id }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setErrorYoutube("No se pudo descargar el vídeo");
    } finally {
      setDescargando(null);
    }
  };

  const desconectarYoutube = () => {
    if (!perfil) return;
    fetch(`${API_URL}/youtube/desconectar?perfil_id=${perfil.id}`, {
      method: "DELETE",
    })
      .then(() => {
        setYoutubeConectado(false);
        setVideos([]);
      })
      .catch(() => setErrorYoutube("No se pudo desconectar"));
  };

  if (!perfil) return null;

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

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border-c">
        <button
          onClick={() => setTab("biblioteca")}
          className={`px-4 py-2 text-sm font-medium transition ${
            tab === "biblioteca"
              ? "border-b-2 border-accent-primary text-text-primary"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          📁 Biblioteca
        </button>
        <button
          onClick={() => setTab("youtube")}
          className={`px-4 py-2 text-sm font-medium transition ${
            tab === "youtube"
              ? "border-b-2 border-accent-primary text-text-primary"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          ▶ YouTube
        </button>
      </div>

      {/* Tab: Biblioteca */}
      {tab === "biblioteca" && (
        <div className="flex flex-1 flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-secondary">
              {archivos.length > 0
                ? `${archivos.length} archivo${archivos.length > 1 ? "s" : ""} en tu biblioteca`
                : "Sube archivos para empezar"}
            </p>
            <button
              onClick={() => setModalSubida(true)}
              className="rounded-lg bg-accent-primary px-3 py-1.5 text-sm font-medium text-white"
            >
              + Subir archivo
            </button>
          </div>

          {errorBiblioteca && (
            <div className="rounded-lg border border-youtube/40 bg-youtube/10 px-4 py-2 text-sm text-youtube">
              {errorBiblioteca}
              <button
                onClick={() => setErrorBiblioteca(null)}
                className="ml-2 underline"
              >
                Cerrar
              </button>
            </div>
          )}

          {archivos.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border-light bg-bg-surface p-12 text-center">
              <span className="text-5xl" aria-hidden>
                📁
              </span>
              <p className="mt-4 text-lg font-medium text-text-secondary">
                Biblioteca vacía
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                Sube archivos de audio o vídeo para procesarlos.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {archivos.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-col gap-2 rounded-2xl border border-border-c bg-bg-surface p-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-2xl" aria-hidden>
                      {a.tipo === "audio" ? "🎵" : "🎬"}
                    </span>
                    <p className="line-clamp-2 flex-1 text-sm font-medium">
                      {a.nombre}
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-bg-elevated px-2 py-0.5 text-xs text-text-secondary">
                      {a.estado === "pendiente" && "○ Pendiente"}
                      {a.estado === "procesado" && "✓ Hecho"}
                      {a.estado === "traducido" && "🌐 Traducido"}
                    </span>
                    <button
                      onClick={() => eliminarArchivo(a.id)}
                      className="text-xs text-text-secondary hover:text-youtube"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Modal de subida */}
          {modalSubida && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
              onClick={() => !subiendo && setModalSubida(false)}
            >
              <div
                className="mx-4 w-full max-w-md rounded-2xl border border-border-c bg-bg-surface p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="mb-4 text-lg font-bold">Subir archivo</h2>
                <label
                  className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border-light p-8 text-center transition hover:border-accent-primary"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file) subirArchivo(file);
                  }}
                >
                  <span className="text-4xl" aria-hidden>
                    ⬆
                  </span>
                  <p className="text-sm text-text-secondary">
                    Arrastra un archivo o haz clic para seleccionar
                  </p>
                  <p className="text-xs text-text-secondary">
                    MP3, MP4, M4A, WAV, FLAC, OGG, AVI, MKV, WEBM, MOV
                  </p>
                  <input
                    type="file"
                    className="hidden"
                    accept="audio/*,video/*"
                    disabled={subiendo}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) subirArchivo(file);
                    }}
                  />
                </label>
                {subiendo && (
                  <p className="mt-3 text-center text-sm text-accent-primary">
                    Subiendo…
                  </p>
                )}
                <button
                  onClick={() => !subiendo && setModalSubida(false)}
                  className="mt-4 w-full rounded-lg border border-border-c px-4 py-2 text-sm text-text-secondary"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: YouTube */}
      {tab === "youtube" && !youtubeConectado && (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border-light bg-bg-surface p-12 text-center">
          <span className="text-5xl" aria-hidden>
            ▶
          </span>
          <p className="mt-4 text-lg font-medium text-text-secondary">
            Conecta tu cuenta de Google
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            Para descargar contenido de tu canal de YouTube.
          </p>
          <button
            onClick={conectarYoutube}
            className="mt-4 rounded-lg bg-accent-primary px-4 py-2 text-sm font-medium text-white"
          >
            Conectar cuenta de Google
          </button>
        </div>
      )}

      {tab === "youtube" && youtubeConectado && (
        <div className="flex flex-1 flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-secondary">
              {videos.length > 0
                ? `${videos.length} vídeos en tu canal`
                : "Carga tus vídeos para descargarlos"}
            </p>
            <div className="flex gap-2">
              <button
                onClick={cargarVideos}
                disabled={cargandoYoutube}
                className="rounded-lg bg-accent-primary px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {cargandoYoutube ? "Cargando…" : "Cargar vídeos"}
              </button>
              <button
                onClick={desconectarYoutube}
                className="rounded-lg border border-border-c px-3 py-1.5 text-sm text-text-secondary"
              >
                Desconectar
              </button>
            </div>
          </div>

          {errorYoutube && (
            <div className="rounded-lg border border-youtube/40 bg-youtube/10 px-4 py-2 text-sm text-youtube">
              {errorYoutube}
              <button
                onClick={() => setErrorYoutube(null)}
                className="ml-2 underline"
              >
                Cerrar
              </button>
            </div>
          )}

          {videos.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {videos.map((v) => (
                <div
                  key={v.id}
                  className="flex flex-col gap-2 rounded-2xl border border-border-c bg-bg-surface p-3"
                >
                  <img
                    src={v.thumbnail}
                    alt={v.titulo}
                    className="aspect-video w-full rounded-lg object-cover"
                  />
                  <p className="line-clamp-2 text-sm font-medium">{v.titulo}</p>
                  <button
                    onClick={() => descargarVideo(v.id)}
                    disabled={descargando === v.id}
                    className="rounded-lg bg-accent-primary/20 px-3 py-1.5 text-xs font-medium text-accent-primary disabled:opacity-50"
                  >
                    {descargando === v.id
                      ? "Descargando…"
                      : "⬇ Descargar audio"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <a
        href="/perfiles"
        className="mx-auto text-sm text-text-secondary hover:text-text-primary"
      >
        ← Cambiar de perfil
      </a>
    </main>
  );
}
