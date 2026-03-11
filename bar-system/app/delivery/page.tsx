"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";

type Categoria = { id: string; nome: string };
type Produto = {
  id: string;
  nome: string;
  preco: number;
  categoria: string;
  setor_impressao: string | null;
};
type TipoPagamento = "dinheiro" | "pix" | "cartao_credito" | "cartao_debito";
type PedidoDelivery = {
  id: string;
  numero: number;
  nome_cliente: string;
  endereco_entrega: string;
  telefone: string;
  tipo_pagamento: TipoPagamento;
  aberto_em: string;
};
type DeliveryAberto = PedidoDelivery & { aberto_em: string };
type ItemDetalhe = {
  itemId: string;
  produto: string;
  quantidade: number;
  observacao: string | null;
  subtotal: number;
};

function escaparHtml(texto: string) {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function labelPagamento(tipo: TipoPagamento): string {
  if (tipo === "pix") return "PIX";
  if (tipo === "cartao_credito") return "Cartão de crédito";
  if (tipo === "cartao_debito") return "Cartão de débito";
  return "Dinheiro";
}

function formatDateTimeBr(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function imprimirPedidoEntregador(pedido: PedidoDelivery, itens: ItemDetalhe[], total: number) {
  const opened = window.open("", "_blank", "width=380,height=760");
  if (!opened) return false;

  const dataHora = new Date().toLocaleString("pt-BR");
  const itensHtml =
    itens.length > 0
      ? itens
          .map(
            (item) =>
              `<div class="line">${item.quantidade}x ${escaparHtml(item.produto)}${item.observacao ? ` (${escaparHtml(item.observacao)})` : ""}</div>`
          )
          .join("")
      : `<div class="line">Sem itens</div>`;

  opened.document.write(`
    <html>
      <head>
        <title>Entrega #${pedido.numero}</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          body { width: 80mm; margin: 0; padding: 6px; font-family: monospace; font-size: 16px; color: #000; }
          .title { font-weight: bold; font-size: 20px; margin-bottom: 10px; text-transform: uppercase; }
          .line { margin: 4px 0; word-break: break-word; }
          .sep { border-top: 2px dashed #000; margin: 10px 0; }
          .total { font-weight: bold; font-size: 18px; margin-top: 8px; }
        </style>
      </head>
      <body>
        <div class="title">Delivery - Entregador</div>
        <div class="line">Pedido: #${pedido.numero}</div>
        <div class="line">Cliente: ${escaparHtml(pedido.nome_cliente)}</div>
        <div class="line">Telefone: ${escaparHtml(pedido.telefone)}</div>
        <div class="line">Pagamento: ${escaparHtml(labelPagamento(pedido.tipo_pagamento))}</div>
        <div class="sep"></div>
        <div class="line"><b>Endereço</b></div>
        <div class="line">${escaparHtml(pedido.endereco_entrega)}</div>
        <div class="sep"></div>
        ${itensHtml}
        <div class="sep"></div>
        <div class="line total">TOTAL: R$ ${total.toFixed(2)}</div>
        <div class="line">Gerado em: ${escaparHtml(dataHora)}</div>
        <div class="line">BarControl</div>
      </body>
    </html>
  `);
  opened.document.close();
  opened.focus();
  opened.print();
  opened.close();
  return true;
}

export default function DeliveryPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [pedidosAbertos, setPedidosAbertos] = useState<DeliveryAberto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [savingPedido, setSavingPedido] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [pedido, setPedido] = useState<PedidoDelivery | null>(null);
  const [itens, setItens] = useState<ItemDetalhe[]>([]);
  const [total, setTotal] = useState(0);

  const [nomeCliente, setNomeCliente] = useState("");
  const [enderecoEntrega, setEnderecoEntrega] = useState("");
  const [telefone, setTelefone] = useState("");
  const [tipoPagamento, setTipoPagamento] = useState<TipoPagamento>("dinheiro");

  const [buscaAbertos, setBuscaAbertos] = useState("");
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);
  const [modalObservacaoOpen, setModalObservacaoOpen] = useState(false);
  const [produtoPendenteId, setProdutoPendenteId] = useState<string | null>(null);
  const [produtoPendenteNome, setProdutoPendenteNome] = useState("");
  const [observacaoDraft, setObservacaoDraft] = useState("");

  useEffect(() => {
    async function carregar() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/delivery", { cache: "no-store" });
        const payload = (await response.json()) as {
          categorias?: Categoria[];
          produtos?: Produto[];
          pedidosAbertos?: DeliveryAberto[];
          message?: string;
        };
        if (!response.ok) {
          throw new Error(payload.message ?? "Erro ao carregar delivery.");
        }
        setCategorias(payload.categorias ?? []);
        setProdutos(payload.produtos ?? []);
        setPedidosAbertos(payload.pedidosAbertos ?? []);
        setOpenCategoryId((payload.categorias ?? [])[0]?.id ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar delivery.");
      } finally {
        setLoading(false);
      }
    }
    void carregar();
  }, []);

  const produtosPorCategoria = useMemo(() => {
    const map = new Map<string, Produto[]>();
    for (const categoria of categorias) {
      map.set(
        categoria.nome,
        produtos.filter((produto) => produto.categoria === categoria.nome)
      );
    }
    return map;
  }, [categorias, produtos]);

  const pedidosFiltrados = useMemo(() => {
    const termo = buscaAbertos.trim().toLowerCase();
    if (!termo) return pedidosAbertos;
    return pedidosAbertos.filter((item) =>
      `${item.numero} ${item.nome_cliente} ${item.telefone} ${item.endereco_entrega} ${item.aberto_em}`
        .toLowerCase()
        .includes(termo)
    );
  }, [buscaAbertos, pedidosAbertos]);

  async function recarregarAbertos() {
    const response = await fetch("/api/delivery", { cache: "no-store" });
    const payload = (await response.json()) as {
      pedidosAbertos?: DeliveryAberto[];
      message?: string;
    };
    if (!response.ok) throw new Error(payload.message ?? "Erro ao recarregar deliveries.");
    setPedidosAbertos(payload.pedidosAbertos ?? []);
  }

  async function carregarDetalhes(deliveryId: string) {
    const response = await fetch(`/api/delivery/${deliveryId}/detalhes`, { cache: "no-store" });
    const payload = (await response.json()) as {
      pedido?: PedidoDelivery;
      itens?: ItemDetalhe[];
      total?: number;
      message?: string;
    };
    if (!response.ok) {
      throw new Error(payload.message ?? "Erro ao carregar detalhes do delivery.");
    }
    if (payload.pedido) {
      setPedido(payload.pedido);
      setNomeCliente(payload.pedido.nome_cliente);
      setTelefone(payload.pedido.telefone);
      setEnderecoEntrega(payload.pedido.endereco_entrega);
      setTipoPagamento(payload.pedido.tipo_pagamento);
    }
    setItens(payload.itens ?? []);
    setTotal(payload.total ?? 0);
  }

  async function iniciarPedido() {
    const nome = nomeCliente.trim();
    const endereco = enderecoEntrega.trim();
    const fone = telefone.trim();
    if (!nome || !endereco || !fone) {
      setError("Preencha nome, endereço e telefone.");
      return;
    }
    setSavingPedido(true);
    setError(null);
    try {
      const response = await fetch("/api/delivery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nomeCliente: nome,
          enderecoEntrega: endereco,
          telefone: fone,
          tipoPagamento
        })
      });
      const payload = (await response.json()) as { pedido?: PedidoDelivery; message?: string };
      if (!response.ok || !payload.pedido) {
        throw new Error(payload.message ?? "Erro ao iniciar pedido de delivery.");
      }
      setPedido(payload.pedido);
      setItens([]);
      setTotal(0);
      setSuccess(`Pedido #${payload.pedido.numero} iniciado e já visível no caixa.`);
      window.setTimeout(() => setSuccess(null), 2200);
      await recarregarAbertos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao iniciar pedido de delivery.");
    } finally {
      setSavingPedido(false);
    }
  }

  function abrirModalObservacao(produtoId: string, produtoNome: string) {
    if (!pedido) {
      setError("Selecione um delivery em aberto (ou inicie um pedido) antes de adicionar itens.");
      return;
    }
    setProdutoPendenteId(produtoId);
    setProdutoPendenteNome(produtoNome);
    setObservacaoDraft("");
    setModalObservacaoOpen(true);
  }

  async function confirmarAdicao(comObservacao: boolean) {
    if (!pedido || !produtoPendenteId) return;
    const observacao = comObservacao ? observacaoDraft.trim() : "";
    setSavingItem(true);
    setError(null);
    try {
      const response = await fetch(`/api/delivery/${pedido.id}/itens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ produtoId: produtoPendenteId, quantidade: 1, observacao })
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "Erro ao adicionar item.");
      }
      await carregarDetalhes(pedido.id);
      const nomeProduto = produtos.find((item) => item.id === produtoPendenteId)?.nome ?? "Item";
      setSuccess(`${nomeProduto} adicionado no delivery #${pedido.numero}.`);
      window.setTimeout(() => setSuccess(null), 1800);
      setModalObservacaoOpen(false);
      setProdutoPendenteId(null);
      setProdutoPendenteNome("");
      setObservacaoDraft("");
      await recarregarAbertos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao adicionar item.");
    } finally {
      setSavingItem(false);
    }
  }

  function imprimir() {
    if (!pedido) return;
    const printed = imprimirPedidoEntregador(pedido, itens, total);
    if (!printed) {
      setError("Não foi possível abrir janela de impressão.");
    }
  }

  async function cancelarItem(itemId: string) {
    const ok = window.confirm("Confirma cancelar este item?");
    if (!ok || !pedido) return;
    setError(null);
    try {
      const response = await fetch(`/api/delivery/item/${itemId}`, { method: "DELETE" });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "Erro ao cancelar item.");
      }
      await carregarDetalhes(pedido.id);
      await recarregarAbertos();
      setSuccess("Item cancelado.");
      window.setTimeout(() => setSuccess(null), 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cancelar item.");
    }
  }

  async function cancelarPedido() {
    if (!pedido) return;
    const ok = window.confirm("Confirma cancelar este pedido de delivery?");
    if (!ok) return;
    setError(null);
    try {
      const response = await fetch(`/api/delivery/${pedido.id}`, { method: "DELETE" });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "Erro ao cancelar pedido.");
      }
      setSuccess(`Pedido #${pedido.numero} cancelado.`);
      window.setTimeout(() => setSuccess(null), 1600);
      novoPedido();
      await recarregarAbertos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cancelar pedido.");
    }
  }

  function novoPedido() {
    setPedido(null);
    setItens([]);
    setTotal(0);
    setNomeCliente("");
    setEnderecoEntrega("");
    setTelefone("");
    setTipoPagamento("dinheiro");
  }

  async function selecionarAberto(item: DeliveryAberto) {
    setError(null);
    try {
      await carregarDetalhes(item.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao abrir delivery.");
    }
  }

  if (loading) {
    return <main className="p-6">Carregando delivery...</main>;
  }

  return (
    <main className="mx-auto max-w-7xl p-4 md:p-6">
      <AppShell
        title="Delivery"
        subtitle={pedido ? `Pedido #${pedido.numero}` : "Pedido por telefone"}
      >
        {error ? <p className="text-sm text-red-600">Erro: {error}</p> : null}
        {success ? <p className="text-sm text-emerald-700">{success}</p> : null}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-3">
            <section className="ui-card p-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-700">Deliveries em aberto</h2>
                <button
                  type="button"
                  onClick={() =>
                    void recarregarAbertos().catch((err) =>
                      setError(err instanceof Error ? err.message : "Erro ao atualizar.")
                    )
                  }
                  className="rounded-lg bg-slate-100 px-2 py-1 text-xs"
                >
                  Atualizar
                </button>
              </div>
              <input
                type="search"
                value={buscaAbertos}
                onChange={(event) => setBuscaAbertos(event.target.value)}
                placeholder="Buscar por nº, nome, telefone..."
                className="ui-input w-full"
              />
              <div className="mt-3 space-y-2">
                {pedidosFiltrados.length === 0 ? (
                  <p className="text-sm text-slate-600">Nenhum delivery em aberto.</p>
                ) : (
                  pedidosFiltrados.map((item) => {
                    const active = pedido?.id === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => void selecionarAberto(item)}
                        className={`w-full rounded-xl px-3 py-2 text-left ${active ? "bg-slate-900 text-white" : "bg-slate-50 hover:bg-slate-100"}`}
                      >
                        <p className="text-sm font-semibold">
                          #{item.numero} {item.nome_cliente}
                        </p>
                        <p className={`text-xs ${active ? "text-white/80" : "text-slate-600"}`}>
                          {item.telefone} · {labelPagamento(item.tipo_pagamento)}
                        </p>
                        <p className={`mt-1 text-xs ${active ? "text-white/80" : "text-slate-600"}`}>
                          {item.endereco_entrega}
                        </p>
                        <p className={`mt-1 text-[11px] ${active ? "text-white/80" : "text-slate-500"}`}>
                          Aberto em: {formatDateTimeBr(item.aberto_em)}
                        </p>
                      </button>
                    );
                  })
                )}
              </div>
            </section>

            <section className="ui-card p-4">
              <h2 className="mb-2 text-base font-semibold">Novo delivery</h2>
              <div className="grid grid-cols-1 gap-2">
                <input
                  value={nomeCliente}
                  onChange={(event) => setNomeCliente(event.target.value)}
                  placeholder="Nome do cliente"
                  className="ui-input"
                  disabled={Boolean(pedido)}
                />
                <input
                  value={telefone}
                  onChange={(event) => setTelefone(event.target.value)}
                  placeholder="Telefone"
                  className="ui-input"
                  disabled={Boolean(pedido)}
                />
                <input
                  value={enderecoEntrega}
                  onChange={(event) => setEnderecoEntrega(event.target.value)}
                  placeholder="Endereço de entrega"
                  className="ui-input"
                  disabled={Boolean(pedido)}
                />
                <select
                  value={tipoPagamento}
                  onChange={(event) => setTipoPagamento(event.target.value as TipoPagamento)}
                  className="ui-input"
                  disabled={Boolean(pedido)}
                >
                  <option value="dinheiro">Dinheiro</option>
                  <option value="pix">PIX</option>
                  <option value="cartao_credito">Cartão de crédito</option>
                  <option value="cartao_debito">Cartão de débito</option>
                </select>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {!pedido ? (
                  <button
                    type="button"
                    disabled={savingPedido}
                    onClick={() => void iniciarPedido()}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60"
                  >
                    {savingPedido ? "Iniciando..." : "Iniciar pedido"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={novoPedido}
                    className="rounded-lg bg-slate-100 px-4 py-2 text-sm"
                  >
                    Novo pedido
                  </button>
                )}
                {pedido ? (
                  <button
                    type="button"
                    onClick={imprimir}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm"
                  >
                    Imprimir para entregador
                  </button>
                ) : null}
              </div>
              <p className="mt-3 text-xs text-slate-500">
                O delivery fica em aberto até o caixa finalizar. Se você sair da tela, ele continua aqui.
              </p>
            </section>
          </aside>

          <section className="space-y-4">
            <section className="ui-card p-4">
              <h2 className="text-base font-semibold">Cardápio</h2>
              {!pedido ? (
                <p className="mt-1 text-sm text-slate-600">
                  Selecione um delivery em aberto (ou inicie um pedido) para lançar itens.
                </p>
              ) : null}

              <div className="mt-3 space-y-3">
                {categorias.map((categoria) => {
                  const isOpen = openCategoryId === categoria.id;
                  return (
                    <article key={categoria.id} className="rounded-xl bg-white">
                      <button
                        type="button"
                        onClick={() => setOpenCategoryId((current) => (current === categoria.id ? null : categoria.id))}
                        className="flex w-full items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-left"
                      >
                        <h3 className="text-sm font-semibold">{categoria.nome}</h3>
                        <span className="text-xs text-slate-500">{isOpen ? "fechar" : "abrir"}</span>
                      </button>

                      {isOpen ? (
                        <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
                          {(produtosPorCategoria.get(categoria.nome) ?? []).map((produto) => (
                            <button
                              key={produto.id}
                              type="button"
                              onClick={() => abrirModalObservacao(produto.id, produto.nome)}
                              disabled={!pedido || savingItem}
                              className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-left hover:bg-slate-100 disabled:opacity-60"
                            >
                              <div>
                                <p className="text-sm font-medium">{produto.nome}</p>
                                <p className="text-xs text-slate-600">R$ {produto.preco.toFixed(2)}</p>
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
              </div>
            </section>

            <section className="ui-card p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {pedido ? (
                    <button
                      type="button"
                      onClick={novoPedido}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-sm text-slate-700"
                      title="Voltar e iniciar outro delivery"
                      aria-label="Voltar e iniciar outro delivery"
                    >
                      ←
                    </button>
                  ) : null}
                  <h2 className="text-base font-semibold">Resumo do pedido</h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">Total R$ {total.toFixed(2)}</span>
                  {pedido ? (
                    <button
                      type="button"
                      onClick={() => void cancelarPedido()}
                      className="rounded-lg bg-white px-3 py-1.5 text-xs text-red-700 shadow-sm"
                    >
                      Cancelar pedido
                    </button>
                  ) : null}
                </div>
              </div>
              {pedido ? (
                <p className="mb-2 text-xs text-slate-600">
                  Pedido #{pedido.numero} · {pedido.nome_cliente} ·{" "}
                  {labelPagamento(pedido.tipo_pagamento)} · Aberto em:{" "}
                  {formatDateTimeBr(pedido.aberto_em)}
                </p>
              ) : null}
              {itens.length === 0 ? (
                <p className="text-sm text-slate-600">Nenhum item adicionado.</p>
              ) : (
                <div className="space-y-1.5">
                  {itens.map((item) => (
                    <div
                      key={item.itemId}
                      className="ui-info flex items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <span>
                          {item.quantidade}x {item.produto}
                          {item.observacao ? ` (${item.observacao})` : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <strong>R$ {item.subtotal.toFixed(2)}</strong>
                        <button
                          type="button"
                          onClick={() => void cancelarItem(item.itemId)}
                          className="rounded-lg bg-white px-2 py-1 text-[11px] text-slate-900 shadow-sm"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-3 text-xs text-slate-500">
                Itens de cozinha deste delivery entram automaticamente no fluxo da cozinha, e o pedido aparece no caixa para finalização.
              </p>
            </section>
          </section>
        </div>

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
                  onClick={() => {
                    setModalObservacaoOpen(false);
                    setProdutoPendenteId(null);
                    setProdutoPendenteNome("");
                    setObservacaoDraft("");
                  }}
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
      </AppShell>
    </main>
  );
}
