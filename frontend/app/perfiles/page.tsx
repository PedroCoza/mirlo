"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Perfil = {
  id: string;
  nombre: string;
  avatar: string;
};

const AVATARES = ["🧑", "💼", "🐣", "🎧", "🎬", "📚", "🎵", "🎤"];
const PERFILES_INICIALES: Perfil[] = [
  { id: "personal", nombre: "Personal", avatar: "🧑" },
  { id: "trabajo", nombre: "Trabajo", avatar: "💼" },
];

export default function SelectorPerfiles() {
  const router = useRouter();
  const [perfiles, setPerfiles] = useState<Perfil[]>(PERFILES_INICIALES);
  const [creando, setCreando] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoAvatar, setNuevoAvatar] = useState("🐣");

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editAvatar, setEditAvatar] = useState("🐣");

  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);

  useEffect(() => {
    const guardados = localStorage.getItem("mirlo-perfiles");
    if (guardados) setPerfiles(JSON.parse(guardados));
  }, []);

  const guardar = (lista: Perfil[]) => {
    setPerfiles(lista);
    localStorage.setItem("mirlo-perfiles", JSON.stringify(lista));
  };

  const seleccionar = (perfil: Perfil) => {
    localStorage.setItem("mirlo-perfil-activo", JSON.stringify(perfil));
    router.push("/nido");
  };

  const crear = () => {
    const nombre = nuevoNombre.trim();
    if (!nombre) return;
    const nuevo: Perfil = {
      id: crypto.randomUUID(),
      nombre,
      avatar: nuevoAvatar,
    };
    guardar([...perfiles, nuevo]);
    setNuevoNombre("");
    setNuevoAvatar("🐣");
    setCreando(false);
  };

  const iniciarEdicion = (perfil: Perfil) => {
    setEditandoId(perfil.id);
    setEditNombre(perfil.nombre);
    setEditAvatar(perfil.avatar);
    setConfirmandoId(null);
  };

  const guardarEdicion = (id: string) => {
    const nombre = editNombre.trim();
    if (!nombre) return;
    guardar(
      perfiles.map((p) =>
        p.id === id ? { ...p, nombre, avatar: editAvatar } : p,
      ),
    );
    setEditandoId(null);
  };

  const eliminar = (id: string) => {
    guardar(perfiles.filter((p) => p.id !== id));
    setConfirmandoId(null);
    const activo = localStorage.getItem("mirlo-perfil-activo");
    if (activo && JSON.parse(activo).id === id) {
      localStorage.removeItem("mirlo-perfil-activo");
    }
  };

  return (
    <main className="mx-auto flex min-h-[calc(100vh-120px)] max-w-4xl flex-col gap-8 px-6 py-12">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Selecciona un perfil</h1>
        <p className="mt-2 text-text-secondary">
          Cada perfil guarda su propia biblioteca y configuración.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {perfiles.map((p) => {
          const editando = editandoId === p.id;
          const confirmando = confirmandoId === p.id;

          if (editando) {
            return (
              <div
                key={p.id}
                className="flex flex-col items-center gap-3 rounded-2xl border border-accent-primary bg-bg-surface p-6"
              >
                <div className="flex flex-wrap justify-center gap-1">
                  {AVATARES.map((a) => (
                    <button
                      key={a}
                      onClick={() => setEditAvatar(a)}
                      className={`rounded-lg p-1 text-2xl transition ${
                        editAvatar === a
                          ? "bg-accent-primary/20 ring-2 ring-accent-primary"
                          : "hover:bg-bg-elevated"
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
                <input
                  autoFocus
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") guardarEdicion(p.id);
                    if (e.key === "Escape") setEditandoId(null);
                  }}
                  placeholder="Nombre del perfil"
                  className="w-full rounded-lg border border-border-c bg-bg-elevated px-3 py-2 text-center text-text-primary outline-none focus:border-accent-primary"
                />
                <div className="flex w-full gap-2">
                  <button
                    onClick={() => guardarEdicion(p.id)}
                    className="flex-1 rounded-lg bg-accent-primary px-3 py-2 text-sm font-medium text-white"
                  >
                    Guardar
                  </button>
                  <button
                    onClick={() => setEditandoId(null)}
                    className="flex-1 rounded-lg border border-border-c px-3 py-2 text-sm text-text-secondary"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            );
          }

          if (confirmando) {
            return (
              <div
                key={p.id}
                className="flex flex-col items-center gap-3 rounded-2xl border border-youtube bg-bg-surface p-6 text-center"
              >
                <span className="text-4xl" aria-hidden>
                  {p.avatar}
                </span>
                <p className="text-sm font-medium">
                  ¿Eliminar "{p.nombre}"?
                </p>
                <p className="text-xs text-text-secondary">
                  Esta acción no se puede deshacer.
                </p>
                <div className="flex w-full gap-2">
                  <button
                    onClick={() => eliminar(p.id)}
                    className="flex-1 rounded-lg bg-youtube px-3 py-2 text-sm font-medium text-white"
                  >
                    Eliminar
                  </button>
                  <button
                    onClick={() => setConfirmandoId(null)}
                    className="flex-1 rounded-lg border border-border-c px-3 py-2 text-sm text-text-secondary"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={p.id}
              className="group relative flex flex-col items-center gap-3 rounded-2xl border border-border-c bg-bg-surface p-6 transition hover:border-accent-primary hover:bg-bg-elevated"
            >
              <button
                onClick={() => seleccionar(p)}
                className="flex flex-col items-center gap-3"
              >
                <span className="text-5xl" aria-hidden>
                  {p.avatar}
                </span>
                <span className="text-lg font-semibold group-hover:text-accent-primary">
                  {p.nombre}
                </span>
              </button>

              <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
                <button
                  onClick={() => iniciarEdicion(p)}
                  className="rounded-lg p-1.5 text-text-secondary hover:bg-bg-elevated hover:text-accent-primary"
                  title="Editar"
                >
                  ✏️
                </button>
                <button
                  onClick={() => setConfirmandoId(p.id)}
                  className="rounded-lg p-1.5 text-text-secondary hover:bg-bg-elevated hover:text-youtube"
                  title="Eliminar"
                >
                  🗑️
                </button>
              </div>
            </div>
          );
        })}

        {/* Crear nuevo perfil */}
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border-light bg-bg-surface p-6">
          {creando ? (
            <div className="flex w-full flex-col gap-3">
              <div className="flex flex-wrap justify-center gap-1">
                {AVATARES.map((a) => (
                  <button
                    key={a}
                    onClick={() => setNuevoAvatar(a)}
                    className={`rounded-lg p-1 text-2xl transition ${
                      nuevoAvatar === a
                        ? "bg-accent-primary/20 ring-2 ring-accent-primary"
                        : "hover:bg-bg-elevated"
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
              <input
                autoFocus
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") crear();
                  if (e.key === "Escape") {
                    setCreando(false);
                    setNuevoNombre("");
                  }
                }}
                placeholder="Nombre del perfil"
                className="rounded-lg border border-border-c bg-bg-elevated px-3 py-2 text-center text-text-primary outline-none focus:border-accent-primary"
              />
              <div className="flex gap-2">
                <button
                  onClick={crear}
                  className="flex-1 rounded-lg bg-accent-primary px-3 py-2 text-sm font-medium text-white"
                >
                  Crear
                </button>
                <button
                  onClick={() => {
                    setCreando(false);
                    setNuevoNombre("");
                    setNuevoAvatar("🐣");
                  }}
                  className="flex-1 rounded-lg border border-border-c px-3 py-2 text-sm text-text-secondary"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setCreando(true)}
              className="flex flex-col items-center gap-2 text-text-secondary transition hover:text-accent-primary"
            >
              <span className="text-5xl" aria-hidden>
                ＋
              </span>
              <span className="text-sm font-medium">Crear nuevo</span>
            </button>
          )}
        </div>
      </div>

      <a
        href="/"
        className="mx-auto text-sm text-text-secondary hover:text-text-primary"
      >
        ← Volver al inicio
      </a>
    </main>
  );
}
