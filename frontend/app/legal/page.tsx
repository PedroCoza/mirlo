export default function Legal() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-120px)] max-w-2xl flex-col gap-6 px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Información legal</h1>

      <section className="rounded-xl border border-border-c bg-bg-surface p-6">
        <h2 className="mb-2 text-lg font-semibold">Licencia</h2>
        <p className="text-sm text-text-secondary">
          Este proyecto se distribuye bajo licencia MIT. El uso, modificación y
          distribución del código fuente está permitido manteniendo el aviso de
          copyright.
        </p>
        <p className="mt-2 text-sm text-text-secondary">
          © 2026 Pedro Coza Mateos
        </p>
      </section>

      <section className="rounded-xl border border-border-c bg-bg-surface p-6">
        <h2 className="mb-2 text-lg font-semibold">Privacidad</h2>
        <p className="text-sm text-text-secondary">
          Mirlo es una aplicación local-first. Todo el procesamiento de audio
          (transcripción, traducción y diarización) se ejecuta en la máquina del
          usuario mediante Docker con soporte GPU. Ningún dato se envía a
          servidores externos.
        </p>
        <p className="mt-2 text-sm text-text-secondary">
          La autenticación con Google OAuth se utiliza únicamente para acceder a
          los metadatos de YouTube del propio usuario y autorizar la descarga de
          su contenido mediante yt-dlp.
        </p>
      </section>

      <section className="rounded-xl border border-border-c bg-bg-surface p-6">
        <h2 className="mb-2 text-lg font-semibold">Tecnologías</h2>
        <ul className="space-y-1 text-sm text-text-secondary">
          <li>WhisperX — Motor de transcripción y diarización</li>
          <li>LibreTranslate — Motor de traducción local</li>
          <li>Next.js + Tailwind CSS — Frontend</li>
          <li>FastAPI — Backend API</li>
          <li>PostgreSQL — Base de datos</li>
          <li>Docker + NVIDIA Container Toolkit — Contenedores GPU</li>
        </ul>
      </section>

      <a href="/" className="text-sm text-accent-primary hover:underline">
        ← Volver al inicio
      </a>
    </main>
  );
}
