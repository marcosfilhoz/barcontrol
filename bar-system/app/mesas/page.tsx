"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";

type Mesa = {
  id: string;
  numero: number;
  status: string | null;
};

const statusColor: Record<string, string> = {
  livre: "bg-emerald-100 text-emerald-900",
  ocupada: "bg-amber-100 text-amber-900",
  fechando: "bg-rose-100 text-rose-900"
};

export default function MesasPage() {
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function carregarMesas() {
      try {
        const response = await fetch("/api/mesas", { cache: "no-store" });
        const payload = (await response.json()) as { mesas?: Mesa[]; message?: string };
        if (!response.ok) {
          throw new Error(payload.message ?? "Erro ao carregar mesas.");
        }
        setMesas(payload.mesas ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar mesas.");
      } finally {
        setLoading(false);
      }
    }

    void carregarMesas();
  }, []);

  const totalLivres = useMemo(
    () => mesas.filter((mesa) => mesa.status === "livre").length,
    [mesas]
  );

  if (loading) {
    return <main className="p-6">Carregando mesas...</main>;
  }

  if (error) {
    return <main className="p-6 text-red-600">Erro: {error}</main>;
  }

  return (
    <main className="mx-auto max-w-7xl p-4 md:p-6">
      <AppShell
        title="Mesas"
        subtitle={`Total: ${mesas.length} | Livres: ${totalLivres}`}
      >
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {mesas.map((mesa) => {
            const colorClass =
              statusColor[mesa.status ?? ""] ??
              "bg-slate-100 border-slate-300 text-slate-900";

            return (
              <Link
                key={mesa.id}
                href={`/mesa/${mesa.id}`}
                onClick={(event) => {
                  if (mesa.status === "livre") {
                    const confirmed = window.confirm(`Deseja abrir a mesa ${mesa.numero}?`);
                    if (!confirmed) {
                      event.preventDefault();
                    }
                  }
                }}
                className={`rounded-2xl p-4 shadow-sm transition hover:scale-[1.01] ${colorClass}`}
              >
                <p className="text-sm opacity-80">Mesa</p>
                <p className="text-2xl font-bold">{mesa.numero}</p>
                <p className="mt-2 text-sm capitalize">{mesa.status ?? "sem status"}</p>
              </Link>
            );
          })}
        </section>
      </AppShell>
    </main>
  );
}
