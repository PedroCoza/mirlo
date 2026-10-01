"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export default function Landing() {
  const [apiEstado, setApiEstado] = useState<"cargando" | "ok" | "error">(
    "cargando",
  );

  // Verifica comunicación con el backend al cargar.
  useEffect(() => {
    const url =
      process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    fetch(`${url}/health`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(() => setApiEstado("ok"))
      .catch(() => setApiEstado("error"));
  }, []);

  return (
    <main className="flex min-h-[calc(100vh-120px)] flex-col items-center justify-center gap-8 px-6 text-center">
      <span className="flex h-28 w-28 items-center justify-center rounded-3xl bg-[#F1F3F2]">
        <Image src="/logo.svg" alt="" width={96} height={96} unoptimized />
      </span>
      <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">Mirlo</h1>
      <p className="max-w-xl text-lg text-text-secondary sm:text-xl">
        Transcripción · Traducción · Diarización de Audio
      </p>

      <span className="rounded-full border border-accent-secondary/40 bg-accent-secondary/10 px-4 py-1 text-sm font-medium text-accent-secondary">
        local-first · Docker · GPU
      </span>

      <a
        href="/perfiles"
        className="eclosion rounded-xl bg-accent-primary px-8 py-3 text-base font-semibold text-white shadow-lg transition hover:opacity-90"
      >
        Comenzar
      </a>

      <div className="mt-2 flex items-center justify-center gap-3 text-xs text-text-secondary">
        <p>
          API:{" "}
          {apiEstado === "cargando" && "conectando…"}
          {apiEstado === "ok" && "🟢 conectada"}
          {apiEstado === "error" && "🔴 sin conexión"}
        </p>
      </div>
    </main>
  );
}
