"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { CrudToolbar } from "@/components/crud-toolbar";
import { ModalPanel } from "@/components/modal-panel";

type Categoria = { id: string; nome: string };

export default function CategoriasPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [nome, setNome] = useState("");
  const [search, setSearch] = useState("");
  const [openModal, setOpenModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/categorias", { cache: "no-store" });
      const payload = (await response.json()) as { categorias?: Categoria[]; message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "Erro ao carregar categorias.");
      }
      setCategorias(payload.categorias ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar categorias.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/categorias", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId ?? undefined, nome })
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "Erro ao criar categoria.");
      }
      setNome("");
      setSuccess(editingId ? "Categoria atualizada." : "Categoria criada.");
      setOpenModal(false);
      setEditingId(null);
      await carregar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar categoria.");
    } finally {
      setSaving(false);
    }
  }

  function handleEditar(categoria: Categoria) {
    setEditingId(categoria.id);
    setNome(categoria.nome);
    setOpenModal(true);
  }

  async function handleExcluir(categoria: Categoria) {
    const ok = window.confirm(`Confirma excluir categoria "${categoria.nome}"?`);
    if (!ok) return;
    try {
      const response = await fetch("/api/categorias", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: categoria.id })
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Erro ao excluir categoria.");
      await carregar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir categoria.");
    }
  }

  const filtradas = categorias.filter((categoria) =>
    categoria.nome.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <main className="p-6">Carregando categorias...</main>;
  }

  return (
    <main className="mx-auto max-w-7xl p-4 md:p-6">
      <AppShell title="Categorias" subtitle="Cadastro de categorias do cardápio.">
        <CrudToolbar
          title="Categorias"
          subtitle="Gestão de categorias."
          searchValue={search}
          searchPlaceholder="Buscar categoria..."
          onSearchChange={setSearch}
          createLabel="+"
          onCreateClick={() => {
            setEditingId(null);
            setNome("");
            setOpenModal(true);
          }}
        />

        <section className="ui-card p-3">
          <div className="grid grid-cols-[1fr_auto] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <p>Nome</p>
            <p>Ações</p>
          </div>
          <div className="space-y-2">
            {filtradas.map((categoria) => (
              <div
                key={categoria.id}
                className="ui-row grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 text-sm"
              >
                <p className="font-medium">{categoria.nome}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleEditar(categoria)}
                    className="rounded-md bg-white px-2 py-1 text-xs"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleExcluir(categoria)}
                    className="rounded-md bg-white px-2 py-1 text-xs text-red-600"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}
            {filtradas.length === 0 ? (
              <p className="px-4 py-4 text-sm text-slate-500">Sem categorias.</p>
            ) : null}
          </div>
        </section>

        <ModalPanel
          open={openModal}
          title={editingId ? "Editar categoria" : "Adicionar categoria"}
          onClose={() => {
            setOpenModal(false);
            setEditingId(null);
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              placeholder="Nome da categoria"
              className="ui-input w-full"
              required
            />
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60"
            >
              {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Adicionar categoria"}
            </button>
          </form>
          {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
          {success ? <p className="mt-2 text-sm text-emerald-700">{success}</p> : null}
        </ModalPanel>
      </AppShell>
    </main>
  );
}
