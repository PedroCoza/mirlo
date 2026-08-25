"use client";

type Tab = {
  id: string;
  etiqueta: string;
};

type Props = {
  tabs: Tab[];
  activa: string;
  onCambiar: (id: string) => void;
};

export default function Tabs({ tabs, activa, onCambiar }: Props) {
  return (
    <div className="flex gap-2 border-b border-border-c">
      {tabs.map((p) => (
        <button
          key={p.id}
          onClick={() => onCambiar(p.id)}
          className={`px-4 py-2 text-sm font-medium transition ${
            activa === p.id
              ? "border-b-2 border-accent-primary text-text-primary"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          {p.etiqueta}
        </button>
      ))}
    </div>
  );
}
