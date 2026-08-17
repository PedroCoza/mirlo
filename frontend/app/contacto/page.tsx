import Link from "next/link";

export default function Contacto() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-120px)] max-w-2xl flex-col gap-6 px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Contacto</h1>

      <div className="rounded-xl border border-border-c bg-bg-surface p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-bg-elevated text-3xl">
            👤
          </div>
          <div>
            <p className="text-lg font-semibold">Pedro Coza Mateos</p>
            <p className="text-text-secondary">Responsable del proyecto</p>
          </div>
        </div>

        <dl className="mt-6 space-y-3 text-sm">
          <div className="flex gap-2">
            <dt className="font-medium text-text-secondary">Email:</dt>
            <dd>pedcozmat@alum.us.es</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium text-text-secondary">Universidad:</dt>
            <dd>Universidad de Sevilla · ETSII</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium text-text-secondary">Proyecto:</dt>
            <dd>Mirlo — Transcripción, Traducción y Diarización de Audio</dd>
          </div>
        </dl>
      </div>

      <Link
        href="/"
        className="text-sm text-accent-primary hover:underline"
      >
        ← Volver al inicio
      </Link>
    </main>
  );
}
