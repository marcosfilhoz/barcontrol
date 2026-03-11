"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";

type PessoaMesa = {
  id: string;
  nome: string;
};

type Categoria = {
  id: string;
  nome: string;
};

type Produto = {
  id: string;
  nome: string;
  preco: number;
  categoria_id: string | null;
};

type DetalhePessoa = {
  pessoaId: string;
  nome: string;
  itens: Array<{
    itemId: string;
    produto: string;
    quantidade: number;
    subtotal: number;
    observacao: string | null;
  }>;
  total: number;
};

export default function MesaDetailPage() {
  const params = useParams<{ id: string }>();
  const mesaId = params.id;

  const [mesaNumero, setMesaNumero] = useState<number | null>(null);
  const [pedidoId, setPedidoId] = useState<string | null>(null);
  const [pedidoNumero, setPedidoNumero] = useState<number | null>(null);
  const [pedidoAbertoEm, setPedidoAbertoEm] = useState<string | null>(null);
  const [pessoas, setPessoas] = useState<PessoaMesa[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [selectedPessoaId, setSelectedPessoaId] = useState<string | null>(null);
  const [newPessoa, setNewPessoa] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingPessoa, setSavingPessoa] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [modalObservacaoOpen, setModalObservacaoOpen] = useState(false);
  const [produtoPendenteId, setProdutoPendenteId] = useState<string | null>(null);
  const [produtoPendenteNome, setProdutoPendenteNome] = useState("");
  const [observacaoDraft, setObservacaoDraft] = useState("");
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showDetalhes, setShowDetalhes] = useState(false);
  const [loadingDetalhes, setLoadingDetalhes] = useState(false);
  const [detalhes, setDetalhes] = useState<DetalhePessoa[]>([]);
  const [totalDetalhes, setTotalDetalhes] = useState(0);

  useEffect(() => {
    async function initMesa() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/mesa/${mesaId}`, { cache: "no-store" });
        const payload = (await response.json()) as {
          mesaNumero?: number;
          pedidoId?: string;
          pedidoNumero?: number;
          pedidoAbertoEm?: string;
          pessoas?: PessoaMesa[];
          categorias?: Categoria[];
          produtos?: Produto[];
          message?: string;
        };
        if (!response.ok) {
          throw new Error(payload.message ?? "Erro ao carregar dados da mesa.");
        }

        const loadedPessoas = payload.pessoas ?? [];
        setMesaNumero(payload.mesaNumero ?? null);
        setPedidoId(payload.pedidoId ?? null);
        setPedidoNumero(payload.pedidoNumero ?? null);
        setPedidoAbertoEm(payload.pedidoAbertoEm ?? null);
        setPessoas(loadedPessoas);
        setCategorias(payload.categorias ?? []);
        setProdutos(payload.produtos ?? []);
        setSelectedPessoaId(loadedPessoas[0]?.id ?? null);
        setOpenCategoryId((payload.categorias ?? [])[0]?.id ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar dados da mesa.");
      } finally {
        setLoading(false);
      }
    }

    if (mesaId) {
      initMesa();
    }
  }, [mesaId]);

  const produtosPorCategoria = useMemo(() => {
    const map = new Map<string, Produto[]>();

    for (const categoria of categorias) {
      map.set(categoria.id, produtos.filter((produto) => produto.categoria_id === categoria.id));
    }

    return map;
  }, [categorias, produtos]);

  async function handleAdicionarPessoa(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nome = newPessoa.trim();
    if (!nome || !pedidoId) return;

    setSavingPessoa(true);
    try {
      const response = await fetch(`/api/mesa/${mesaId}/pessoas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome })
      });
      const payload = (await response.json()) as {
        pessoa?: PessoaMesa;
        message?: string;
      };
      if (!response.ok || !payload.pessoa) {
        throw new Error(payload.message ?? "Erro ao adicionar pessoa.");
      }

      const novasPessoas = [...pessoas, payload.pessoa].sort((a, b) =>
        a.nome.localeCompare(b.nome)
      );
      setPessoas(novasPessoas);
      setSelectedPessoaId(payload.pessoa.id);
      setNewPessoa("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao adicionar pessoa.");
    } finally {
      setSavingPessoa(false);
    }
  }

  async function handleAdicionarItem(produtoId: string, observacao?: string) {
    if (!selectedPessoaId) {
      setError("Selecione uma pessoa antes de adicionar itens.");
      return;
    }

    setSavingItem(true);
    try {
      const response = await fetch(`/api/mesa/${mesaId}/itens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pessoaId: selectedPessoaId,
          produtoId,
          quantidade: 1,
          observacao
        })
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "Erro ao adicionar item.");
      }

      const nomePessoa = pessoas.find((pessoa) => pessoa.id === selectedPessoaId)?.nome ?? "Pessoa";
      const nomeProduto = produtos.find((produto) => produto.id === produtoId)?.nome ?? "Item";
      setSuccessMessage(`${nomeProduto} adicionado para ${nomePessoa}.`);
      window.setTimeout(() => setSuccessMessage(null), 1800);
      if (showDetalhes) {
        await carregarDetalhes();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao adicionar item.");
    } finally {
      setSavingItem(false);
    }
  }

  function abrirModalObservacao(produtoId: string, produtoNome: string) {
    setProdutoPendenteId(produtoId);
    setProdutoPendenteNome(produtoNome);
    setObservacaoDraft("");
    setModalObservacaoOpen(true);
  }

  async function confirmarAdicao(comObservacao: boolean) {
    if (!produtoPendenteId) return;
    const observacao = comObservacao ? observacaoDraft.trim() : "";
    await handleAdicionarItem(produtoPendenteId, observacao);
    setModalObservacaoOpen(false);
    setProdutoPendenteId(null);
    setProdutoPendenteNome("");
    setObservacaoDraft("");
  }

  async function carregarDetalhes() {
    setLoadingDetalhes(true);
    try {
      const response = await fetch(`/api/mesa/${mesaId}/detalhes`, { cache: "no-store" });
      const payload = (await response.json()) as {
        pessoas?: DetalhePessoa[];
        totalGeral?: number;
        message?: string;
      };
      if (!response.ok) {
        throw new Error(payload.message ?? "Erro ao carregar detalhes.");
      }
      setDetalhes(payload.pessoas ?? []);
      setTotalDetalhes(payload.totalGeral ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar detalhes.");
    } finally {
      setLoadingDetalhes(false);
    }
  }

  async function toggleDetalhes() {
    const next = !showDetalhes;
    setShowDetalhes(next);
    if (next) {
      await carregarDetalhes();
    }
  }

  async function cancelarItem(itemId: string) {
    const ok = window.confirm("Confirma cancelar este item?");
    if (!ok) return;
    try {
      const response = await fetch(`/api/mesa/item/${itemId}`, { method: "DELETE" });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "Erro ao cancelar item.");
      }
      await carregarDetalhes();
      setSuccessMessage("Item cancelado.");
      window.setTimeout(() => setSuccessMessage(null), 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cancelar item.");
    }
  }

  function formatDateTimeBr(value: string | null): string {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  }

  if (loading) {
    return <main className="p-6">Carregando mesa...</main>;
  }

  if (error) {
    return <main className="p-6 text-red-600">Erro: {error}</main>;
  }

  return (
    <main className="mx-auto max-w-7xl p-4 md:p-6">
      <AppShell
        title={`Mesa ${mesaNumero ?? "-"}`}
        subtitle={`Pedido atual: ${
          pedidoNumero ? `#${pedidoNumero}` : "-"
        } · Aberto em: ${formatDateTimeBr(pedidoAbertoEm)}`}
      >
        <div className="space-y-6">
          {successMessage ? (
            <section className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900 shadow-sm">
              {successMessage}
            </section>
          ) : null}

          <section className="ui-card p-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">Pessoas da mesa</h2>
              <button
                type="button"
                onClick={() => void toggleDetalhes()}
                className="rounded-lg bg-slate-100 px-2 py-1 text-xs"
              >
                {showDetalhes ? "Ocultar detalhes" : "Detalhes"}
              </button>
            </div>

            <form onSubmit={handleAdicionarPessoa} className="flex items-center gap-2">
              <button
                type="submit"
                disabled={savingPessoa}
                aria-label="Adicionar pessoa"
                className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-900 text-lg leading-none text-white disabled:opacity-60"
              >
                {savingPessoa ? "..." : "+"}
              </button>
              <input
                value={newPessoa}
                onChange={(event) => setNewPessoa(event.target.value)}
                placeholder="Nome da pessoa"
                className="ui-input w-full max-w-xs"
              />
            </form>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {pessoas.map((pessoa) => {
                const active = selectedPessoaId === pessoa.id;

                return (
                  <button
                    key={pessoa.id}
                    type="button"
                    onClick={() => setSelectedPessoaId(pessoa.id)}
                    className={`rounded-lg px-2.5 py-1.5 text-xs ${active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-900"}`}
                  >
                    {pessoa.nome}
                  </button>
                );
              })}
            </div>

            {showDetalhes ? (
              <div className="mt-3 rounded-xl bg-slate-50 p-2.5">
                {loadingDetalhes ? (
                  <p className="text-xs text-slate-600">Carregando detalhes...</p>
                ) : detalhes.length === 0 ? (
                  <p className="text-xs text-slate-600">Nenhum item lançado ainda.</p>
                ) : (
                  <div className="space-y-2">
                    {detalhes.map((pessoa) => (
                      <article key={pessoa.pessoaId} className="rounded-xl bg-white p-2 shadow-sm">
                        <p className="text-sm font-semibold">{pessoa.nome}</p>
                        <div className="mt-1 space-y-1">
                          {pessoa.itens.map((item) => (
                            <div key={item.itemId} className="ui-info flex items-center justify-between gap-2 text-xs">
                              <span className="text-slate-700">
                                {item.quantidade}x {item.produto}
                                {item.observacao ? ` (${item.observacao})` : ""}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="ui-info-value">R$ {item.subtotal.toFixed(2)}</span>
                                <button
                                  type="button"
                                  onClick={() => void cancelarItem(item.itemId)}
                                  className="rounded-md bg-white px-2 py-1 text-[11px]"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="mt-1">
                          <span className="ui-info inline-flex items-center gap-1.5 text-xs">
                            <span className="ui-info-label">Total</span>
                            <span className="ui-info-value">R$ {pessoa.total.toFixed(2)}</span>
                          </span>
                        </p>
                      </article>
                    ))}
                    <p className="text-right">
                      <span className="ui-info inline-flex items-center gap-1.5 text-sm">
                        <span className="ui-info-label">Total da mesa</span>
                        <span className="ui-info-value">R$ {totalDetalhes.toFixed(2)}</span>
                      </span>
                    </p>
                  </div>
                )}
              </div>
            ) : null}
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Produtos</h2>
            {categorias.map((categoria) => {
              const isOpen = openCategoryId === categoria.id;
              return (
                <article key={categoria.id} className="ui-card">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenCategoryId((current) =>
                        current === categoria.id ? null : categoria.id
                      )
                    }
                    className="flex w-full items-center justify-between p-4 text-left"
                  >
                    <h3 className="text-base font-semibold">{categoria.nome}</h3>
                    <span className="text-xs text-slate-500">{isOpen ? "fechar" : "abrir"}</span>
                  </button>

                  {isOpen ? (
                    <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
                      {(produtosPorCategoria.get(categoria.id) ?? []).map((produto) => (
                        <button
                          key={produto.id}
                          type="button"
                          onClick={() => abrirModalObservacao(produto.id, produto.nome)}
                          disabled={savingItem}
                          className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-left hover:bg-slate-100 disabled:opacity-60"
                        >
                          <div>
                            <p className="text-sm font-medium">{produto.nome}</p>
                            <p className="text-xs text-slate-600">
                              R$ {Number(produto.preco).toFixed(2)}
                            </p>
                          </div>
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-lg leading-none text-white">
                            +
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </section>

          {modalObservacaoOpen ? (
            <section className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4">
              <div className="ui-card w-full max-w-md p-4">
                <h3 className="text-base font-semibold">Adicionar item</h3>
                <p className="mt-1 text-sm text-slate-600">{produtoPendenteNome}</p>

                <label className="mt-3 block text-xs text-slate-600">Observação (opcional)</label>
                <textarea
                  value={observacaoDraft}
                  onChange={(event) => setObservacaoDraft(event.target.value)}
                  placeholder='Ex: sem cebola'
                  rows={3}
                  className="ui-input mt-1 w-full resize-none"
                />

                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setModalObservacaoOpen(false)}
                    className="rounded-lg bg-slate-100 px-3 py-2 text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => void confirmarAdicao(false)}
                    className="rounded-lg bg-white px-3 py-2 text-sm shadow-sm"
                  >
                    Pular
                  </button>
                  <button
                    type="button"
                    onClick={() => void confirmarAdicao(true)}
                    className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white"
                  >
                    Adicionar
                  </button>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </AppShell>
    </main>
  );
}
