"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Perfil = { id: string; nombre: string; avatar: string };
type VideoYouTube = { id: string; titulo: string; thumbnail: string };

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function Nido() {
  const router = useRouter();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [listo, setListo] = useState(false);
  const [tab, setTab] = useState<"biblioteca" | "youtube">("biblioteca");
  const [youtubeConectado, setYoutubeConectado] = useState(false);
  const [videos, setVideos] = useState<VideoYouTube[]>([]);
  const [cargandoYoutube, setCargandoYoutube] = useState(false);
  const [errorYoutube, setErrorYoutube] = useState<string | null>(null);
  const [descargando, setDescargando] = useState<string | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    const activo = localStorage.getItem("mirlo-perfil-activo");
    if (activo) {
      setPerfil(JSON.parse(activo));
    }
    setListo(true);
  }, []);

  // Verifica si acaba de llegar del callback de OAuth.
  useEffect(() => {
    if (searchParams.get("youtube") === "conectado") {
      setYoutubeConectado(true);
      setTab("youtube");
    }
  }, [searchParams]);

  // Comprueba el estado de conexión de YouTube al cargar.
  useEffect(() => {
    if (!perfil) return;
    fetch(`${API_URL}/youtube/conectado?perfil_id=${perfil.id}`)
      .then((r) => r.json())
      .then((d) => setYoutubeConectado(d.conectado))
      .catch(() => {});
  }, [perfil]);

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
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border-light bg-bg-surface p-12 text-center">
          <span className="text-5xl" aria-hidden>
            📁
          </span>
          <p className="mt-4 text-lg font-medium text-text-secondary">
            Biblioteca local
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            Próximamente: subida de archivos locales.
          </p>
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
