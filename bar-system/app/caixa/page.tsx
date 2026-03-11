"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";

type MesaAberta = {
  id: string;
  numero: number;
  pedidoId: string;
  pedidoNumero: number;
};

type DeliveryAberto = {
  id: string;
  pedidoNumero: number;
  nomeCliente: string;
  telefone: string;
  endereco: string;
  tipoPagamento: "dinheiro" | "pix" | "cartao_credito" | "cartao_debito";
};

type PessoaResumo = {
  id: string;
  nome: string;
  total: number;
  itensPendentes: number;
  itens: Array<{ itemId: string; produto: string; quantidade: number; observacao: string | null }>;
};

type ContaResumo = {
  atendimentoTipo: "mesa" | "delivery";
  mesa: MesaAberta | null;
  delivery: DeliveryAberto | null;
  pessoas: PessoaResumo[];
  totalGeral: number;
  abertoEm: string;
};

function escaparHtml(texto: string) {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function labelPagamento(tipo: DeliveryAberto["tipoPagamento"]): string {
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

function todayInBrasilia(): string {
  const nowInBr = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  );
  const year = nowInBr.getFullYear();
  const month = String(nowInBr.getMonth() + 1).padStart(2, "0");
  const day = String(nowInBr.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function imprimirCupomConta(resumo: ContaResumo, dataSelecionada: string) {
  const opened = window.open("", "_blank", "width=360,height=760");
  if (!opened) return false;

  const dataHora = new Date().toLocaleString("pt-BR");
  const pessoasHtml = resumo.pessoas
    .map((pessoa) => {
      const itensHtml =
        pessoa.itens.length > 0
          ? pessoa.itens
              .map(
                (item) =>
                  `<div class="line item">${item.quantidade}x ${escaparHtml(item.produto)}${item.observacao ? ` (${escaparHtml(item.observacao)})` : ""}</div>`
              )
              .join("")
          : `<div class="line">Sem itens pendentes</div>`;

      return `
        <div class="sep"></div>
        <div class="line"><b>${escaparHtml(pessoa.nome)}</b></div>
        ${itensHtml}
        <div class="line">Subtotal: R$ ${pessoa.total.toFixed(2)}</div>
      `;
    })
    .join("");

  opened.document.write(`
    <html>
      <head>
        <title>Fechamento ${resumo.atendimentoTipo === "mesa" ? `Mesa ${resumo.mesa?.numero ?? "-"}` : `Delivery #${resumo.delivery?.pedidoNumero ?? "-"}`}</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          body { width: 80mm; margin: 0; padding: 6px; font-family: monospace; font-size: 16px; color: #000; }
          .title { font-weight: bold; font-size: 20px; margin-bottom: 10px; text-transform: uppercase; }
          .line { margin: 4px 0; word-break: break-word; }
          .item { padding-left: 6px; }
          .sep { border-top: 2px dashed #000; margin: 10px 0; }
          .total { font-weight: bold; font-size: 18px; margin-top: 8px; }
        </style>
      </head>
      <body>
        <div class="title">Comanda para fechamento</div>
        <div class="line">${resumo.atendimentoTipo === "mesa" ? `Mesa: ${resumo.mesa?.numero ?? "-"}` : "Tipo: Delivery"}</div>
        <div class="line">Pedido: #${resumo.mesa?.pedidoNumero ?? resumo.delivery?.pedidoNumero ?? "-"}</div>
        ${resumo.delivery ? `<div class="line">Cliente: ${escaparHtml(resumo.delivery.nomeCliente)}</div>` : ""}
        ${resumo.delivery ? `<div class="line">Telefone: ${escaparHtml(resumo.delivery.telefone)}</div>` : ""}
        ${resumo.delivery ? `<div class="line">Pagamento: ${escaparHtml(labelPagamento(resumo.delivery.tipoPagamento))}</div>` : ""}
        ${resumo.delivery ? `<div class="line">Endereço: ${escaparHtml(resumo.delivery.endereco)}</div>` : ""}
        <div class="line">Data do caixa: ${escaparHtml(dataSelecionada)}</div>
        <div class="line">Gerado em: ${escaparHtml(dataHora)}</div>
        ${pessoasHtml}
        <div class="sep"></div>
        <div class="line total">TOTAL GERAL: R$ ${resumo.totalGeral.toFixed(2)}</div>
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

export default function CaixaPage() {
  const [resumos, setResumos] = useState<ContaResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [openMesaId, setOpenMesaId] = useState<string | null>(null);
  const [openPessoaId, setOpenPessoaId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const today = useMemo(() => todayInBrasilia(), []);
  const [dataInicio, setDataInicio] = useState(today);
  const [dataFim, setDataFim] = useState(today);

  const carregarDados = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        dataInicio,
        dataFim
      });
      const response = await fetch(`/api/caixa/resumo?${params.toString()}`, {
        cache: "no-store"
      });
      const payload = (await response.json()) as { resumos?: ContaResumo[]; message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "Erro ao carregar caixa.");
      }
      setResumos(payload.resumos ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar caixa.");
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim]);

  useEffect(() => {
    void carregarDados();
  }, [carregarDados]);

  async function fecharPessoa(pessoaId: string) {
    const ok = window.confirm("Confirma fechar esta pessoa?");
    if (!ok) return;
    setProcessingId(pessoaId);
    try {
      const response = await fetch("/api/caixa/fechar-pessoa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pessoaId })
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "Erro ao fechar pessoa.");
      }
      await carregarDados();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao fechar pessoa.");
    } finally {
      setProcessingId(null);
    }
  }

  async function fecharMesa(mesaId: string, pedidoId: string) {
    const ok = window.confirm("Confirma fechar esta mesa?");
    if (!ok) return;
    setProcessingId(mesaId);
    try {
      const response = await fetch("/api/caixa/fechar-mesa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mesaId, pedidoId })
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "Erro ao fechar mesa.");
      }
      await carregarDados();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao fechar mesa.");
    } finally {
      setProcessingId(null);
    }
  }

  async function fecharDelivery(deliveryId: string) {
    const ok = window.confirm("Confirma finalizar este delivery?");
    if (!ok) return;
    setProcessingId(deliveryId);
    try {
      const response = await fetch("/api/caixa/fechar-delivery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryId })
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "Erro ao finalizar delivery.");
      }
      await carregarDados();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao finalizar delivery.");
    } finally {
      setProcessingId(null);
    }
  }

  function imprimirConta(resumo: ContaResumo) {
    const label =
      dataInicio === dataFim || !dataFim
        ? dataInicio
        : `${dataInicio} a ${dataFim}`;
    const printed = imprimirCupomConta(resumo, label);
    if (!printed) {
      setError("Não foi possível abrir janela de impressão.");
    }
  }

  const resumosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return resumos;
    return resumos.filter((resumo) => {
      const pessoasTexto = resumo.pessoas
        .map((pessoa) => `${pessoa.nome} ${pessoa.itens.map((item) => item.produto).join(" ")}`)
        .join(" ");
      const numero = resumo.mesa?.numero ?? "";
      const pedido = resumo.mesa?.pedidoNumero ?? resumo.delivery?.pedidoNumero ?? "";
      const deliveryTexto = resumo.delivery
        ? `${resumo.delivery.nomeCliente} ${resumo.delivery.telefone} ${resumo.delivery.endereco}`
        : "";
      return `${numero} ${pedido} ${deliveryTexto} ${pessoasTexto}`
        .toLowerCase()
        .includes(termo);
    });
  }, [resumos, busca]);

  const totalAberto = useMemo(
    () => resumosFiltrados.reduce((acc, resumo) => acc + resumo.totalGeral, 0),
    [resumosFiltrados]
  );

  if (loading) {
    return <main className="p-6">Carregando caixa...</main>;
  }

  if (error) {
    return <main className="p-6 text-red-600">Erro: {error}</main>;
  }

  return (
    <main className="mx-auto max-w-7xl p-4 md:p-6">
      <AppShell
        title="Caixa"
        subtitle={`Contas abertas: ${resumosFiltrados.length} | Total em aberto: R$ ${totalAberto.toFixed(2)}`}
      >
        <section className="mb-3 flex flex-wrap items-center gap-2">
          <label className="flex flex-col text-xs text-slate-600">
            <span>Data início</span>
            <input
              type="date"
              value={dataInicio}
              onChange={(event) => setDataInicio(event.target.value)}
              className="ui-input mt-1"
            />
          </label>
          <label className="flex flex-col text-xs text-slate-600">
            <span>Data fim</span>
            <input
              type="date"
              value={dataFim}
              onChange={(event) => setDataFim(event.target.value)}
              className="ui-input mt-1"
            />
          </label>
          <input
            type="search"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Filtrar por mesa, pedido, pessoa ou item..."
            className="ui-input min-w-[280px]"
          />
        </section>
        <div className="space-y-5">
          {resumosFiltrados.map((resumo) => (
            <section
              key={resumo.atendimentoTipo === "mesa" ? resumo.mesa?.id : resumo.delivery?.id}
              className="ui-card p-4"
            >
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() =>
                    setOpenMesaId((current) =>
                      current === (resumo.mesa?.id ?? resumo.delivery?.id ?? null)
                        ? null
                        : (resumo.mesa?.id ?? resumo.delivery?.id ?? null)
                    )
                  }
                  className="text-left"
                >
                  <p className="text-lg font-semibold">
                    {resumo.atendimentoTipo === "mesa"
                      ? `Mesa ${resumo.mesa?.numero ?? "-"}`
                      : `Delivery #${resumo.delivery?.pedidoNumero ?? "-"}`}
                  </p>
                  <p className="text-xs text-slate-600">
                    {resumo.atendimentoTipo === "mesa"
                      ? `${resumo.pessoas.length} pessoa(s)`
                      : resumo.delivery?.nomeCliente}
                    {" | "}Aberto em: {formatDateTimeBr(resumo.abertoEm)}{" | "}Total R${" "}
                    {resumo.totalGeral.toFixed(2)}
                  </p>
                </button>
              </div>

              {openMesaId === (resumo.mesa?.id ?? resumo.delivery?.id) ? (
                <>
                  {resumo.delivery ? (
                    <div className="mt-3 grid grid-cols-1 gap-2 rounded-xl bg-slate-50 p-3 text-sm md:grid-cols-3">
                      <p>
                        <span className="ui-info-label">Telefone</span>{" "}
                        <span className="ui-info-value">{resumo.delivery.telefone}</span>
                      </p>
                      <p>
                        <span className="ui-info-label">Pagamento</span>{" "}
                        <span className="ui-info-value">
                          {labelPagamento(resumo.delivery.tipoPagamento)}
                        </span>
                      </p>
                      <p className="md:col-span-3">
                        <span className="ui-info-label">Endereço</span>{" "}
                        <span className="ui-info-value">{resumo.delivery.endereco}</span>
                      </p>
                    </div>
                  ) : null}
                  <div className="mt-3">
                    {resumo.pessoas.map((pessoa, index) => (
                      <div
                        key={pessoa.id}
                        className={index === 0 ? "pt-0" : "border-t border-slate-200/70 pt-2"}
                      >
                        <article
                          className="ui-row cursor-pointer p-3"
                          onClick={() =>
                            setOpenPessoaId((current) => (current === pessoa.id ? null : pessoa.id))
                          }
                        >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{pessoa.nome}</p>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              <span className="ui-info text-xs">
                                <span className="ui-info-label">Itens</span>{" "}
                                <span className="ui-info-value">{pessoa.itensPendentes}</span>
                              </span>
                              <span className="ui-info text-xs">
                                <span className="ui-info-label">Total</span>{" "}
                                <span className="ui-info-value">R$ {pessoa.total.toFixed(2)}</span>
                              </span>
                            </div>
                          </div>
                          <span className="text-xs text-slate-500">
                            {openPessoaId === pessoa.id ? "fechar" : "abrir"}
                          </span>
                        </div>
                        {openPessoaId === pessoa.id ? (
                          <div className="mt-2 space-y-1">
                            {pessoa.itens.map((item) => (
                              <div key={item.itemId} className="ui-info text-xs">
                                {item.quantidade}x {item.produto}
                                {item.observacao ? ` (${item.observacao})` : ""}
                              </div>
                            ))}
                          </div>
                        ) : null}
                        <div className="mt-2 flex justify-end">
                          {resumo.atendimentoTipo === "mesa" ? (
                            <button
                              type="button"
                              disabled={processingId === pessoa.id}
                              onClick={(event) => {
                                event.stopPropagation();
                                void fecharPessoa(pessoa.id);
                              }}
                              className="rounded-lg bg-white px-3 py-2 text-sm text-slate-900 shadow-sm disabled:opacity-60"
                            >
                              Fechar
                            </button>
                          ) : null}
                        </div>
                        </article>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <p>
                      <span className="ui-info inline-flex items-center gap-1.5">
                        <span className="ui-info-label">Total geral</span>
                        <span className="ui-info-value">R$ {resumo.totalGeral.toFixed(2)}</span>
                      </span>
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => imprimirConta(resumo)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm disabled:opacity-60"
                        title="Imprimir comanda"
                        aria-label="Imprimir comanda"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4"
                          aria-hidden="true"
                        >
                          <path d="M6 9V2h12v7" />
                          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                          <rect x="6" y="14" width="12" height="8" />
                        </svg>
                        Imprimir
                      </button>
                      <button
                        type="button"
                        disabled={processingId === (resumo.mesa?.id ?? resumo.delivery?.id ?? "")}
                        onClick={() => {
                          if (resumo.atendimentoTipo === "mesa" && resumo.mesa) {
                            void fecharMesa(resumo.mesa.id, resumo.mesa.pedidoId);
                            return;
                          }
                          if (resumo.delivery) {
                            void fecharDelivery(resumo.delivery.id);
                          }
                        }}
                        className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60"
                      >
                        {resumo.atendimentoTipo === "mesa" ? "Fechar mesa" : "Finalizar delivery"}
                      </button>
                    </div>
                  </div>
                </>
              ) : null}
            </section>
          ))}
          {resumosFiltrados.length === 0 ? (
            <section className="ui-card p-5 text-center text-sm text-slate-600">
              Nenhuma mesa encontrada para o filtro aplicado.
            </section>
          ) : null}
        </div>
      </AppShell>
    </main>
  );
}
 