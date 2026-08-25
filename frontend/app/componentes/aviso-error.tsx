"use client";

type Props = {
  mensaje: string | null;
  onCerrar: () => void;
  centrado?: boolean;
};

export default function AvisoError({ mensaje, onCerrar, centrado }: Props) {
  if (!mensaje) return null;

  return (
    <div
      className={`rounded-lg border border-youtube/40 bg-youtube/10 px-4 py-2 text-sm text-youtube ${
        centrado ? "mx-auto" : ""
      }`}
    >
      {mensaje}
      <button onClick={onCerrar} className="ml-2 cursor-pointer underline">
        Cerrar
      </button>
    </div>
  );
}
