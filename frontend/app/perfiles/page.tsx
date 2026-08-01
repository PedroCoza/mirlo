"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Perfil = {
  id: string;
  nombre: string;
  avatar: string;
};

const PERFILES_INICIALES: Perfil[] = [
  { id: "personal", nombre: "Personal", avatar: "🧑" },
  { id: "trabajo", nombre: "Trabajo", avatar: "💼" },
];

export default function SelectorPerfiles() {
  const router = useRouter();
  const [perfiles, setPerfiles] = useState<Perfil[]>(PERFILES_INICIALES);
  const [creando, setCreando] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");

  // Carga perfiles guardados en localStorage.
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
      avatar: "🐣",
    };
    guardar([...perfiles, nuevo]);
    setNuevoNombre("");
    setCreando(false);
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
        {perfiles.map((p) => (
          <button
            key={p.id}
            onClick={() => seleccionar(p)}
            className="group flex flex-col items-center gap-3 rounded-2xl border border-border-c bg-bg-surface p-6 transition hover:border-accent-primary hover:bg-bg-elevated"
          >
            <span className="text-5xl" aria-hidden>
              {p.avatar}
            </span>
            <span className="text-lg font-semibold group-hover:text-accent-primary">
              {p.nombre}
            </span>
          </button>
        ))}

        {/* Crear nuevo perfil */}
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border-light bg-bg-surface p-6">
          {creando ? (
            <div className="flex w-full flex-col gap-2">
              <input
                autoFocus
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && crear()}
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
