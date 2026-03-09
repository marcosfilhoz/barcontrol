"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { CrudToolbar } from "@/components/crud-toolbar";
import { ModalPanel } from "@/components/modal-panel";

type Categoria = { id: string; nome: string };
type ProdutoResumo = {
  id: string;
  nome: string;
  preco: number;
  categoria: string;
  setor_impressao: string | null;
};

export default function CardapioPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [produtos, setProdutos] = useState<ProdutoResumo[]>([]);
  const [nome, setNome] = useState("");
  const [preco, setPreco] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [setorImpressao, setSetorImpressao] = useState<"cozinha" | "bar">("cozinha");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroSetor, setFiltroSetor] = useState<"todos" | "cozinha" | "bar">("todos");
  const [openModal, setOpenModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const carregarDados = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/cardapio", { cache: "no-store" });
      const payload = (await response.json()) as {
        categorias?: Categoria[];
        produtos?: ProdutoResumo[];
        message?: string;
      };
      if (!response.ok) {
        throw new Error(payload.message ?? "Erro ao carregar cardápio.");
      }
      const categoriasData = payload.categorias ?? [];
      setCategorias(categoriasData);
      setProdutos(payload.produtos ?? []);
      setCategoriaId((current) => current || categoriasData[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar cardápio.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregarDados();
  }, [carregarDados]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/cardapio", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId ?? undefined,
          nome: nome.trim(),
          preco: Number(preco.replace(",", ".")),
          categoriaId,
          setorImpressao
        })
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "Erro ao cadastrar produto.");
      }
      setNome("");
      setPreco("");
      setSetorImpressao("cozinha");
      setSuccess(editingId ? "Item atualizado com sucesso." : "Produto cadastrado com sucesso.");
      setOpenModal(false);
      setEditingId(null);
      await carregarDados();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cadastrar produto.");
    } finally {
      setSaving(false);
    }
  }

  function handleEditar(produto: ProdutoResumo) {
    setEditingId(produto.id);
    setNome(produto.nome);
    setPreco(String(produto.preco));
    setSetorImpressao((produto.setor_impressao as "cozinha" | "bar" | null) ?? "cozinha");
    const categoriaItem = categorias.find(
      (item) => item.nome.toLowerCase() === produto.categoria.toLowerCase()
    );
    if (categoriaItem) setCategoriaId(categoriaItem.id);
    setOpenModal(true);
  }

  async function handleExcluir(produto: ProdutoResumo) {
    const ok = window.confirm(`Confirma excluir ${produto.nome}?`);
    if (!ok) return;
    try {
      const response = await fetch("/api/cardapio", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: produto.id })
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Erro ao excluir item.");
      await carregarDados();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir item.");
    }
  }

  const produtosFiltrados = useMemo(() => {
    const termo = search.trim().toLowerCase();
    return produtos.filter((produto) => {
      const atendeBusca = `${produto.nome} ${produto.categoria}`
        .toLowerCase()
        .includes(termo);
      const atendeCategoria = filtroCategoria === "todas" || produto.categoria === filtroCategoria;
      const atendeSetor = filtroSetor === "todos" || produto.setor_impressao === filtroSetor;
      return atendeBusca && atendeCategoria && atendeSetor;
    });
  }, [produtos, search, filtroCategoria, filtroSetor]);

  if (loading) {
    return <main className="p-6">Carregando cardápio...</main>;
  }

  return (
    <main className="mx-auto max-w-7xl p-4 md:p-6">
      <AppShell title="Cardápio" subtitle="Cadastro de produtos por categoria.">
        <CrudToolbar
          title="Menu itens"
          subtitle="Cardápio de itens."
          searchValue={search}
          searchPlaceholder="Search..."
          onSearchChange={setSearch}
          createLabel="+"
          onCreateClick={() => {
            setEditingId(null);
            setNome("");
            setPreco("");
            setSetorImpressao("cozinha");
            setOpenModal(true);
          }}
        />
        <section className="mb-3 flex flex-wrap items-center gap-2">
          <select
            value={filtroCategoria}
            onChange={(event) => setFiltroCategoria(event.target.value)}
            className="ui-input"
          >
            <option value="todas">Todas categorias</option>
            {categorias.map((categoria) => (
              <option key={categoria.id} value={categoria.nome}>
                {categoria.nome}
              </option>
            ))}
          </select>
          <select
            value={filtroSetor}
            onChange={(event) => setFiltroSetor(event.target.value as "todos" | "cozinha" | "bar")}
            className="ui-input"
          >
            <option value="todos">Todos setores</option>
            <option value="cozinha">Cozinha</option>
            <option value="bar">Bar / Drinks</option>
          </select>
        </section>

        <section className="rounded-2xl bg-white p-3 shadow-sm">
          <div className="grid grid-cols-[1.2fr_0.9fr_0.7fr_0.7fr_0.9fr] gap-3 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <p>Nome</p>
            <p>Categoria</p>
            <p>Valor</p>
            <p>Setor</p>
            <p>Ações</p>
          </div>
          <div className="space-y-2">
            {produtosFiltrados.map((produto) => (
              <div
                key={produto.id}
                className="grid grid-cols-[1.2fr_0.9fr_0.7fr_0.7fr_0.9fr] gap-3 rounded-xl bg-slate-50/80 px-4 py-3 text-sm"
              >
                <p className="font-medium">{produto.nome}</p>
                <p className="text-slate-700">{produto.categoria}</p>
                <p>R$ {produto.preco.toFixed(2)}</p>
                <p className="capitalize">{produto.setor_impressao ?? "-"}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleEditar(produto)}
                    className="rounded-md bg-white px-2 py-1 text-xs"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleExcluir(produto)}
                    className="rounded-md bg-white px-2 py-1 text-xs text-red-600"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}
            {produtosFiltrados.length === 0 ? (
              <p className="px-4 py-4 text-sm text-slate-500">Sem produtos.</p>
            ) : null}
          </div>
        </section>

        <ModalPanel
          open={openModal}
          title={editingId ? "Editar item" : "Adicionar item"}
          onClose={() => {
            setOpenModal(false);
            setEditingId(null);
          }}
        >
          <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-2">
            <input
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              placeholder="Nome"
              className="ui-input"
              required
            />
            <input
              value={preco}
              onChange={(event) => setPreco(event.target.value)}
              placeholder="Valor"
              className="ui-input"
              required
            />
            <select
              value={categoriaId}
              onChange={(event) => setCategoriaId(event.target.value)}
              className="ui-input"
              required
            >
              {categorias.map((categoria) => (
                <option key={categoria.id} value={categoria.id}>
                  {categoria.nome}
                </option>
              ))}
            </select>
            <select
              value={setorImpressao}
              onChange={(event) => setSetorImpressao(event.target.value as "cozinha" | "bar")}
              className="ui-input"
            >
              <option value="cozinha">Cozinha</option>
              <option value="bar">Bar / Drinks</option>
            </select>
            <button
              type="submit"
              disabled={saving}
              className="md:col-span-2 rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60"
            >
              {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Adicionar item"}
            </button>
          </form>
          {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
          {success ? <p className="mt-2 text-sm text-emerald-700">{success}</p> : null}
        </ModalPanel>
      </AppShell>
    </main>
  );
}
