"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Perfil = { id: string; nombre: string; avatar: string };

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

type ConfigResp = {
  gpu_disponible: boolean;
  gpu_nombre: string | null;
  vram_mb: number | null;
  recomendado: { modelo: string; compute_type: string; batch_size: number };
  actual: {
    modelo: string;
    compute_type: string;
    batch_size: number;
    hf_token_configurado: boolean;
  };
};

export default function Configuracion() {
  const router = useRouter();
  const perfil = useSyncExternalStore(
    suscribirStorage,
    leerPerfilLocal,
    () => null,
  );

  const [config, setConfig] = useState<ConfigResp | null>(null);
  const [modelo, setModelo] = useState("base");
  const [computeType, setComputeType] = useState("int8");
  const [batchSize, setBatchSize] = useState(8);
  const [hfToken, setHfToken] = useState("");
  const [guardado, setGuardado] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!perfil) return;
    fetch(`${API_URL}/config?perfil_id=${perfil.id}`)
      .then((r) => r.json())
      .then((d: ConfigResp) => {
        setConfig(d);
        setModelo(d.actual.modelo);
        setComputeType(d.actual.compute_type);
        setBatchSize(d.actual.batch_size);
      })
      .catch(() => {});
  }, [perfil]);

  // En recarga completa el perfil llega null desde el snapshot del
  // servidor hasta que hidrata; sin este flag el guard redirige a
  // /perfiles antes de leer localStorage.
  const hidratado = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    if (hidratado && !perfil) {
      router.replace("/perfiles");
    }
  }, [hidratado, perfil, router]);

  const guardar = async () => {
    if (!perfil) return;
    setGuardando(true);
    try {
      await fetch(`${API_URL}/config/${perfil.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelo,
          compute_type: computeType,
          batch_size: batchSize,
          hf_token: hfToken || undefined,
        }),
      });
      setGuardado(true);
      setHfToken("");
      setTimeout(() => setGuardado(false), 3000);
    } catch {
      // error silencioso
    } finally {
      setGuardando(false);
    }
  };

  if (!perfil) return null;

  return (
    <main className="mx-auto flex min-h-[calc(100vh-120px)] max-w-2xl flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-bold">Configuración del sistema</h1>

      <section className="rounded-2xl border border-border-c bg-bg-surface p-6">
        <h2 className="mb-3 text-lg font-semibold">Hardware detectado</h2>
        {config ? (
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-text-secondary">GPU</dt>
              <dd>{config.gpu_nombre ?? "No disponible"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-secondary">VRAM</dt>
              <dd>
                {config.vram_mb ? `${config.vram_mb} MB` : "—"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-secondary">CUDA</dt>
              <dd>
                {config.gpu_disponible
                  ? "✓ Disponible"
                  : "✗ No disponible"}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-text-secondary">Detectando…</p>
        )}
      </section>

      <section className="rounded-2xl border border-border-c bg-bg-surface p-6">
        <h2 className="mb-4 text-lg font-semibold">
          Parámetros de transcripción
        </h2>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-text-secondary">
              Modelo WhisperX
            </span>
            <select
              value={modelo}
              onChange={(e) => setModelo(e.target.value)}
              className="rounded-lg border border-border-c bg-bg-elevated px-3 py-2 text-sm"
            >
              <option value="base">base</option>
              <option value="small">small</option>
              <option value="medium">medium</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-text-secondary">
              Compute type
            </span>
            <select
              value={computeType}
              onChange={(e) => setComputeType(e.target.value)}
              className="rounded-lg border border-border-c bg-bg-elevated px-3 py-2 text-sm"
            >
              <option value="int8">int8</option>
              <option value="float16">float16</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-text-secondary">
              Batch size ({batchSize})
            </span>
            <input
              type="range"
              min="1"
              max="16"
              value={batchSize}
              onChange={(e) => setBatchSize(Number(e.target.value))}
              className="accent-accent-primary"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-border-c bg-bg-surface p-6">
        <h2 className="mb-2 text-lg font-semibold">Token de HuggingFace</h2>
        <p className="mb-3 text-sm text-text-secondary">
          Necesario para la diarización con pyannote. Se almacena en la base de
          datos local.
        </p>
        <input
          type="password"
          value={hfToken}
          onChange={(e) => setHfToken(e.target.value)}
          placeholder={
            config?.actual.hf_token_configurado
              ? "Token configurado (escribe para cambiar)"
              : "hf_xxx..."
          }
          className="w-full rounded-lg border border-border-c bg-bg-elevated px-3 py-2 text-sm"
        />
      </section>

      <div className="flex items-center gap-4">
        <button
          onClick={guardar}
          disabled={guardando}
          className="rounded-lg bg-accent-primary px-6 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>
        {guardado && (
          <span className="text-sm text-accent-secondary">✓ Guardado</span>
        )}
        <Link
          href="/"
          className="ml-auto text-sm text-text-secondary hover:text-text-primary"
        >
          ← Volver a Inicio
        </Link>
      </div>
    </main>
  );
}
