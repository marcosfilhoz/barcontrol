"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";

type MesaStatus = "livre" | "ocupada" | "fechando";
type Mesa = { id: string; status: MesaStatus | null };
type CaixaResumo = { totalGeral: number };
type CozinhaItem = { itemId: string; impresso: boolean };
type CozinhaFiltro = "pendentes" | "impressos" | "todos";
type StatusFiltro = "todos" | MesaStatus;
type DashboardView = "resumo" | "relatório";
type ItemDetalheFechamento = {
  itemId: string;
  pessoaNome: string;
  produto: string;
  quantidade: number;
  observacao: string | null;
  subtotal: number;
};
type LinhaFechamento = {
  tipo?: "mesa" | "delivery";
  pedidoId: string;
  pedidoNumero: number;
  mesaNumero: number;
  clienteNome?: string;
  abertoEm: string;
  fechadoEm: string;
  pessoas: number;
  itens: number;
  total: number;
  itensDetalhe: ItemDetalheFechamento[];
};
type ResumoFechamento = {
  pedidosFechados: number;
  mesasFechadas: number;
  deliveriesFechados?: number;
  faturamento: number;
  ticketMedio: number;
  itensVendidos: number;
};
type RelatorioTipoFiltro = "todos" | "mesa" | "delivery";

function formatCurrency(value: number): string {
  return `R$ ${value.toFixed(2)}`;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR");
}

export default function Home() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [resumosCaixa, setResumosCaixa] = useState<CaixaResumo[]>([]);
  const [cozinhaItens, setCozinhaItens] = useState<CozinhaItem[]>([]);
  const [totalProdutos, setTotalProdutos] = useState(0);
  const [totalDeliveriesAbertos, setTotalDeliveriesAbertos] = useState(0);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [errorDashboard, setErrorDashboard] = useState<string | null>(null);
  const [dataFiltro, setDataFiltro] = useState(today);
  const [statusMesaFiltro, setStatusMesaFiltro] = useState<StatusFiltro>("todos");
  const [cozinhaFiltro, setCozinhaFiltro] = useState<CozinhaFiltro>("pendentes");
  const [visaoAtiva, setVisaoAtiva] = useState<DashboardView>("resumo");
  const [dataInicioRelatorio, setDataInicioRelatorio] = useState(today);
  const [dataFimRelatorio, setDataFimRelatorio] = useState(today);
  const [linhasFechamento, setLinhasFechamento] = useState<LinhaFechamento[]>([]);
  const [resumoFechamento, setResumoFechamento] = useState<ResumoFechamento>({
    pedidosFechados: 0,
    mesasFechadas: 0,
    faturamento: 0,
    ticketMedio: 0,
    itensVendidos: 0
  });
  const [loadingRelatorio, setLoadingRelatorio] = useState(true);
  const [errorRelatorio, setErrorRelatorio] = useState<string | null>(null);
  const [openPedidoId, setOpenPedidoId] = useState<string | null>(null);
  const [relatorioTipoFiltro, setRelatorioTipoFiltro] = useState<RelatorioTipoFiltro>("todos");

  const { linhasFiltradas: linhasRelatorio, resumoFiltrado: resumoRelatorio } = useMemo(() => {
    const filtradas =
      relatorioTipoFiltro === "todos"
        ? linhasFechamento
        : linhasFechamento.filter((l) => (l.tipo ?? "mesa") === relatorioTipoFiltro);
    const faturamento = filtradas.reduce((acc, l) => acc + l.total, 0);
    const itensVendidos = filtradas.reduce((acc, l) => acc + l.itens, 0);
    const mesasFechadas =
      relatorioTipoFiltro === "delivery"
        ? 0
        : new Set(filtradas.filter((l) => (l.tipo ?? "mesa") === "mesa").map((l) => l.mesaNumero)).size;
    const deliveriesFechados =
      relatorioTipoFiltro === "mesa" ? 0 : filtradas.filter((l) => l.tipo === "delivery").length;
    return {
      linhasFiltradas: filtradas,
      resumoFiltrado: {
        pedidosFechados: filtradas.length,
        mesasFechadas: mesasFechadas,
        deliveriesFechados,
        faturamento,
        ticketMedio: filtradas.length ? faturamento / filtradas.length : 0,
        itensVendidos
      }
    };
  }, [linhasFechamento, relatorioTipoFiltro]);

  const carregarDashboard = useCallback(async () => {
    setLoadingDashboard(true);
    setErrorDashboard(null);
    try {
      const [mesasRes, caixaRes, cardapioRes, cozinhaRes, deliveryRes] = await Promise.all([
        fetch("/api/mesas", { cache: "no-store" }),
        fetch(`/api/caixa/resumo?data=${dataFiltro}`, { cache: "no-store" }),
        fetch("/api/cardapio", { cache: "no-store" }),
        fetch(`/api/cozinha?filtro=${cozinhaFiltro}&data=${dataFiltro}`, {
          cache: "no-store"
        }),
        fetch("/api/delivery", { cache: "no-store" })
      ]);

      const parseJson = async (res: Response) => {
        const text = await res.text();
        try {
          return text ? JSON.parse(text) : {};
        } catch {
          return {};
        }
      };

      const [mesasPayload, caixaPayload, cardapioPayload, cozinhaPayload, deliveryPayload] =
        await Promise.all([
        parseJson(mesasRes),
        parseJson(caixaRes),
        parseJson(cardapioRes),
          parseJson(cozinhaRes),
          parseJson(deliveryRes)
      ]);

      if (!mesasRes.ok) throw new Error((mesasPayload as { message?: string }).message ?? "Erro ao carregar mesas.");
      if (!caixaRes.ok) throw new Error((caixaPayload as { message?: string }).message ?? "Erro ao carregar caixa.");
      if (!cardapioRes.ok) throw new Error((cardapioPayload as { message?: string }).message ?? "Erro ao carregar cardápio.");
      if (!cozinhaRes.ok) throw new Error((cozinhaPayload as { message?: string }).message ?? "Erro ao carregar cozinha.");
      if (!deliveryRes.ok) {
        throw new Error((deliveryPayload as { message?: string }).message ?? "Erro ao carregar deliveries.");
      }

      setMesas((mesasPayload as { mesas?: Mesa[] }).mesas ?? []);
      setResumosCaixa((caixaPayload as { resumos?: CaixaResumo[] }).resumos ?? []);
      setTotalProdutos(((cardapioPayload as { produtos?: Array<{ id: string }> }).produtos ?? []).length);
      setCozinhaItens((cozinhaPayload as { itens?: CozinhaItem[] }).itens ?? []);
      setTotalDeliveriesAbertos(
        ((deliveryPayload as { pedidosAbertos?: Array<{ id: string }> }).pedidosAbertos ?? [])
          .length
      );
    } catch (err) {
      setErrorDashboard(err instanceof Error ? err.message : "Erro ao carregar dashboard.");
    } finally {
      setLoadingDashboard(false);
    }
  }, [cozinhaFiltro, dataFiltro]);

  const carregarRelatorio = useCallback(async () => {
    setLoadingRelatorio(true);
    setErrorRelatorio(null);
    try {
      const query = new URLSearchParams({
        dataInicio: dataInicioRelatorio,
        dataFim: dataFimRelatorio
      });
      const response = await fetch(`/api/relatorios/fechamentos?${query.toString()}`, {
        cache: "no-store"
      });
      const payload = (await response.json()) as {
        linhas?: LinhaFechamento[];
        resumo?: ResumoFechamento;
        message?: string;
      };
      if (!response.ok) {
        throw new Error(payload.message ?? "Erro ao carregar relatório.");
      }
      setLinhasFechamento(payload.linhas ?? []);
      setResumoFechamento(
        payload.resumo ?? {
          pedidosFechados: 0,
          mesasFechadas: 0,
          faturamento: 0,
          ticketMedio: 0,
          itensVendidos: 0
        }
      );
    } catch (err) {
      setErrorRelatorio(err instanceof Error ? err.message : "Erro ao carregar relatório.");
    } finally {
      setLoadingRelatorio(false);
    }
  }, [dataFimRelatorio, dataInicioRelatorio]);

  useEffect(() => {
    void carregarDashboard();
  }, [carregarDashboard]);

  useEffect(() => {
    void carregarRelatorio();
  }, [carregarRelatorio]);

  const mesasFiltradas = useMemo(
    () =>
      statusMesaFiltro === "todos"
        ? mesas
        : mesas.filter((mesa) => mesa.status === statusMesaFiltro),
    [mesas, statusMesaFiltro]
  );

  const mesasLivres = useMemo(
    () => mesasFiltradas.filter((mesa) => mesa.status === "livre").length,
    [mesasFiltradas]
  );

  const mesasOcupadas = useMemo(
    () => mesasFiltradas.filter((mesa) => mesa.status === "ocupada").length,
    [mesasFiltradas]
  );

  const mesasFechando = useMemo(
    () => mesasFiltradas.filter((mesa) => mesa.status === "fechando").length,
    [mesasFiltradas]
  );

  const mesasAbertas = resumosCaixa.length;
  const totalAberto = useMemo(
    () => resumosCaixa.reduce((acc, item) => acc + item.totalGeral, 0),
    [resumosCaixa]
  );
  const itensCozinhaTotal = cozinhaItens.length;
  const itensCozinhaImpressos = useMemo(
    () => cozinhaItens.filter((item) => item.impresso).length,
    [cozinhaItens]
  );
  const itensCozinhaPendentes = itensCozinhaTotal - itensCozinhaImpressos;

  function limparFiltrosDaVisaoAtual() {
    if (visaoAtiva === "resumo") {
      setDataFiltro(today);
      setStatusMesaFiltro("todos");
      setCozinhaFiltro("pendentes");
      return;
    }
    setDataInicioRelatorio(today);
    setDataFimRelatorio(today);
    setOpenPedidoId(null);
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl p-4 md:p-6">
      <AppShell
        title="Dashboard"
        subtitle="Visão geral da operação do bar com filtros."
      >
        <section className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-3 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-slate-800">Visão do dashboard</p>
            <p className="text-xs text-slate-500">
              Separe por resumo operacional ou relatório de fechamentos.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={visaoAtiva}
              onChange={(event) => setVisaoAtiva(event.target.value as DashboardView)}
              className="ui-input min-w-[170px]"
            >
              <option value="resumo">Resumo</option>
              <option value="relatório">Relatório</option>
            </select>
            <button
              type="button"
              onClick={limparFiltrosDaVisaoAtual}
              className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700"
            >
              Limpar filtros
            </button>
          </div>
        </section>

        {visaoAtiva === "resumo" ? (
          <>
            {errorDashboard ? <p className="mb-3 text-sm text-red-600">Erro: {errorDashboard}</p> : null}
            <section className="mb-4 grid grid-cols-1 gap-3 rounded-2xl bg-white p-3 shadow-sm md:grid-cols-3">
              <label className="grid gap-1 text-sm text-slate-700">
                Data
                <input
                  type="date"
                  value={dataFiltro}
                  onChange={(event) => setDataFiltro(event.target.value)}
                  className="ui-input"
                />
              </label>
              <label className="grid gap-1 text-sm text-slate-700">
                Status da mesa
                <select
                  value={statusMesaFiltro}
                  onChange={(event) => setStatusMesaFiltro(event.target.value as StatusFiltro)}
                  className="ui-input"
                >
                  <option value="todos">Todos</option>
                  <option value="livre">Livre</option>
                  <option value="ocupada">Ocupada</option>
                  <option value="fechando">Fechando</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm text-slate-700">
                Filtro cozinha
                <select
                  value={cozinhaFiltro}
                  onChange={(event) => setCozinhaFiltro(event.target.value as CozinhaFiltro)}
                  className="ui-input"
                >
                  <option value="pendentes">Pendentes</option>
                  <option value="impressos">Impressos</option>
                  <option value="todos">Todos</option>
                </select>
              </label>
            </section>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <article className="ui-card p-4">
                <p className="ui-info-label">Mesas (filtro)</p>
                <p className="mt-1 text-3xl font-bold">{loadingDashboard ? "-" : mesasFiltradas.length}</p>
              </article>
              <article className="ui-card p-4">
                <p className="ui-info-label">Mesas livres</p>
                <p className="mt-1 text-3xl font-bold">{loadingDashboard ? "-" : mesasLivres}</p>
              </article>
              <article className="ui-card p-4">
                <p className="ui-info-label">Mesas ocupadas</p>
                <p className="mt-1 text-3xl font-bold">{loadingDashboard ? "-" : mesasOcupadas}</p>
              </article>
              <article className="ui-card p-4">
                <p className="ui-info-label">Mesas fechando</p>
                <p className="mt-1 text-3xl font-bold">{loadingDashboard ? "-" : mesasFechando}</p>
              </article>
              <article className="ui-card p-4">
                <p className="ui-info-label">Mesas abertas</p>
                <p className="mt-1 text-3xl font-bold">{loadingDashboard ? "-" : mesasAbertas}</p>
              </article>
              <article className="ui-card p-4">
                <p className="ui-info-label">Total em aberto</p>
                <p className="mt-1 text-3xl font-bold">
                  R$ {loadingDashboard ? "-" : totalAberto.toFixed(2)}
                </p>
              </article>
              <article className="ui-card p-4">
                <p className="ui-info-label">Produtos no cardápio</p>
                <p className="mt-1 text-3xl font-bold">{loadingDashboard ? "-" : totalProdutos}</p>
              </article>
              <article className="ui-card p-4">
                <p className="ui-info-label">Itens cozinha (filtro)</p>
                <p className="mt-1 text-3xl font-bold">{loadingDashboard ? "-" : itensCozinhaTotal}</p>
              </article>
              <article className="ui-card p-4">
                <p className="ui-info-label">Cozinha pendentes</p>
                <p className="mt-1 text-3xl font-bold">{loadingDashboard ? "-" : itensCozinhaPendentes}</p>
              </article>
              <article className="ui-card p-4">
                <p className="ui-info-label">Cozinha impressos</p>
                <p className="mt-1 text-3xl font-bold">{loadingDashboard ? "-" : itensCozinhaImpressos}</p>
              </article>
              <article className="ui-card p-4">
                <p className="ui-info-label">Deliveries em aberto</p>
                <p className="mt-1 text-3xl font-bold">
                  {loadingDashboard ? "-" : totalDeliveriesAbertos}
                </p>
              </article>
            </div>
          </>
        ) : (
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="mb-4">
              <h2 className="text-xl font-bold">Relatório de Fechamentos</h2>
              <p className="text-sm text-slate-600">Mesas e deliveries fechados no período.</p>
            </div>

            {errorRelatorio ? <p className="mb-3 text-sm text-red-600">Erro: {errorRelatorio}</p> : null}

            <section className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="grid gap-1 text-sm text-slate-700">
                Data início
                <input
                  type="date"
                  value={dataInicioRelatorio}
                  onChange={(event) => setDataInicioRelatorio(event.target.value)}
                  className="ui-input"
                />
              </label>
              <label className="grid gap-1 text-sm text-slate-700">
                Data fim
                <input
                  type="date"
                  value={dataFimRelatorio}
                  onChange={(event) => setDataFimRelatorio(event.target.value)}
                  className="ui-input"
                />
              </label>
              <label className="grid gap-1 text-sm text-slate-700">
                Tipo
                <select
                  value={relatorioTipoFiltro}
                  onChange={(e) => setRelatorioTipoFiltro(e.target.value as RelatorioTipoFiltro)}
                  className="ui-input"
                >
                  <option value="todos">Todos</option>
                  <option value="mesa">Mesa</option>
                  <option value="delivery">Delivery</option>
                </select>
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => void carregarRelatorio()}
                  className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm text-white"
                >
                  Atualizar relatório
                </button>
              </div>
            </section>

            <section className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <article className="ui-card p-4">
                <p className="ui-info-label">Pedidos fechados</p>
                <p className="mt-1 text-3xl font-bold">
                  {loadingRelatorio ? "-" : resumoRelatorio.pedidosFechados}
                </p>
              </article>
              <article className="ui-card p-4">
                <p className="ui-info-label">Mesas fechadas</p>
                <p className="mt-1 text-3xl font-bold">
                  {loadingRelatorio ? "-" : resumoRelatorio.mesasFechadas}
                </p>
              </article>
              <article className="ui-card p-4">
                <p className="ui-info-label">Deliveries fechados</p>
                <p className="mt-1 text-3xl font-bold">
                  {loadingRelatorio ? "-" : (resumoRelatorio.deliveriesFechados ?? 0)}
                </p>
              </article>
              <article className="ui-card p-4">
                <p className="ui-info-label">Faturamento</p>
                <p className="mt-1 text-3xl font-bold">
                  {loadingRelatorio ? "-" : formatCurrency(resumoRelatorio.faturamento)}
                </p>
              </article>
              <article className="ui-card p-4">
                <p className="ui-info-label">Ticket médio</p>
                <p className="mt-1 text-3xl font-bold">
                  {loadingRelatorio ? "-" : formatCurrency(resumoRelatorio.ticketMedio)}
                </p>
              </article>
              <article className="ui-card p-4">
                <p className="ui-info-label">Itens vendidos</p>
                <p className="mt-1 text-3xl font-bold">
                  {loadingRelatorio ? "-" : resumoRelatorio.itensVendidos}
                </p>
              </article>
            </section>

            <section className="space-y-3">
              {linhasRelatorio.map((linha) => {
                const aberto = openPedidoId === linha.pedidoId;
                return (
                  <article key={linha.pedidoId} className="ui-card p-4">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenPedidoId((current) => (current === linha.pedidoId ? null : linha.pedidoId))
                      }
                      className="w-full text-left"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-base font-semibold">
                          {linha.tipo === "delivery" ? (
                            <>Delivery #{linha.pedidoNumero}{linha.clienteNome ? ` · ${linha.clienteNome}` : ""}</>
                          ) : (
                            <>Mesa {linha.mesaNumero} | Pedido #{linha.pedidoNumero}</>
                          )}
                        </p>
                        <p className="text-sm font-semibold">{formatCurrency(linha.total)}</p>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">
                        Fechado em {formatDateTime(linha.fechadoEm)} | {aberto ? "ocultar" : "detalhes"}
                      </p>
                    </button>

                    {aberto ? (
                      <div className="mt-3 space-y-3 text-sm text-slate-700">
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        <p className="ui-info">
                          <span className="ui-info-label">Abertura</span>{" "}
                          <span className="ui-info-value">{formatDateTime(linha.abertoEm)}</span>
                        </p>
                        <p className="ui-info">
                          <span className="ui-info-label">Fechamento</span>{" "}
                          <span className="ui-info-value">{formatDateTime(linha.fechadoEm)}</span>
                        </p>
                        {linha.tipo === "delivery" && linha.clienteNome ? (
                          <p className="ui-info md:col-span-2">
                            <span className="ui-info-label">Cliente</span>{" "}
                            <span className="ui-info-value">{linha.clienteNome}</span>
                          </p>
                        ) : (
                          <p className="ui-info">
                            <span className="ui-info-label">Pessoas</span>{" "}
                            <span className="ui-info-value">{linha.pessoas}</span>
                          </p>
                        )}
                        <p className="ui-info">
                          <span className="ui-info-label">Itens</span>{" "}
                          <span className="ui-info-value">{linha.itens}</span>
                        </p>
                        <p className="ui-info md:col-span-2">
                          <span className="ui-info-label">Total</span>{" "}
                          <span className="ui-info-value">{formatCurrency(linha.total)}</span>
                        </p>
                        </div>

                        <div className="rounded-xl bg-slate-50/80 p-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Itens do pedido
                          </p>
                          <div className="space-y-2">
                            {linha.itensDetalhe.map((item) => (
                              <div
                                key={item.itemId}
                                className="rounded-lg border border-slate-200 bg-white p-2"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="font-medium">
                                    {item.quantidade}x {item.produto}
                                  </p>
                                  <p className="text-xs font-semibold text-slate-700">
                                    {formatCurrency(item.subtotal)}
                                  </p>
                                </div>
                                <p className="text-xs text-slate-600">{linha.tipo === "delivery" ? "Cliente" : "Pessoa"}: {item.pessoaNome}</p>
                                <p className="text-xs text-slate-600">
                                  Obs: {item.observacao?.trim() ? item.observacao : "-"}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}

              {!loadingRelatorio && linhasRelatorio.length === 0 ? (
                <section className="ui-card p-5 text-center text-sm text-slate-600">
                  Nenhum fechamento encontrado no período{relatorioTipoFiltro !== "todos" ? ` para ${relatorioTipoFiltro === "mesa" ? "mesa" : "delivery"}` : ""}.
                </section>
              ) : null}
            </section>
          </section>
        )}
      </AppShell>
    </main>
  );
}
