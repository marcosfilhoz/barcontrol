"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";

type ItemCozinha = {
  itemId: string;
  mesaNumero: number;
  pessoaNome: string;
  categoriaNome: string;
  produtoNome: string;
  quantidade: number;
  observacao: string | null;
  pedidoNumero: number;
  impresso: boolean;
  finalizado: boolean;
  atendimentoTipo: "mesa" | "delivery";
};

type GrupoCozinha = {
  key: string;
  mesaNumero: number;
  pessoaNome: string;
  pedidoNumero: number;
  itens: ItemCozinha[];
};

function getNomeItemComCategoria(item: ItemCozinha) {
  return `${item.categoriaNome} ${item.produtoNome}`.trim();
}

function escaparHtml(texto: string) {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function ordenarItensCozinhaImpressao(a: ItemCozinha, b: ItemCozinha) {
  if (a.pedidoNumero !== b.pedidoNumero) return a.pedidoNumero - b.pedidoNumero;
  const p = a.pessoaNome.localeCompare(b.pessoaNome, "pt-BR");
  if (p !== 0) return p;
  return a.itemId.localeCompare(b.itemId);
}

function grupoKeyFromItem(item: ItemCozinha) {
  return `${item.atendimentoTipo}::${item.pedidoNumero}::${item.pessoaNome}`;
}

function printTicket80mm(itens: ItemCozinha[]) {
  if (itens.length === 0) return false;
  const opened = window.open("", "_blank", "width=360,height=960");
  if (!opened) return false;

  const head = itens[0];
  const isMesa = head.atendimentoTipo === "mesa";
  const sorted = [...itens].sort(ordenarItensCozinhaImpressao);

  let bodyHtml: string;
  if (!isMesa) {
    const titulo = sorted.length > 1 ? "COZINHA - NOVOS ITENS" : "COZINHA - NOVO ITEM";
    const blocosItens = sorted
      .map(
        (item) => `
        <div class="sep"></div>
        <div class="line"><b>${item.quantidade}x ${escaparHtml(getNomeItemComCategoria(item))}</b></div>
        <div class="line">Obs: ${escaparHtml(item.observacao ?? "-")}</div>`
      )
      .join("");
    bodyHtml = `
        <div class="title">${titulo}</div>
        <div class="line">Delivery</div>
        <div class="line">Pedido: #${sorted[0].pedidoNumero}</div>
        <div class="line">Cliente: ${escaparHtml(sorted[0].pessoaNome)}</div>
        ${blocosItens}
        <div class="sep"></div>
        <div class="line">BarControl</div>`;
  } else {
    const titulo = sorted.length > 1 ? "COZINHA - NOVOS ITENS" : "COZINHA - NOVO ITEM";
    const mesaNum = sorted[0].mesaNumero;
    const mesmoPedidoPessoa = sorted.every(
      (i) => i.pedidoNumero === sorted[0].pedidoNumero && i.pessoaNome === sorted[0].pessoaNome
    );
    const blocos = mesmoPedidoPessoa
      ? `
        <div class="sep"></div>
        <div class="line">Pedido: #${sorted[0].pedidoNumero}</div>
        <div class="line">Pessoa: ${escaparHtml(sorted[0].pessoaNome)}</div>
        ${sorted
          .map(
            (item) => `
        <div class="line"><b>${item.quantidade}x ${escaparHtml(getNomeItemComCategoria(item))}</b></div>
        <div class="line">Obs: ${escaparHtml(item.observacao ?? "-")}</div>`
          )
          .join("")}`
      : sorted
          .map(
            (item) => `
        <div class="sep"></div>
        <div class="line">Pedido: #${item.pedidoNumero}</div>
        <div class="line">Pessoa: ${escaparHtml(item.pessoaNome)}</div>
        <div class="line"><b>${item.quantidade}x ${escaparHtml(getNomeItemComCategoria(item))}</b></div>
        <div class="line">Obs: ${escaparHtml(item.observacao ?? "-")}</div>`
          )
          .join("");
    bodyHtml = `
        <div class="title">${titulo}</div>
        <div class="line">Mesa: ${mesaNum}</div>
        ${blocos}
        <div class="sep"></div>
        <div class="line">BarControl</div>`;
  }

  opened.document.write(`
    <html>
      <head>
        <title>Comanda Cozinha</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          body {
            width: 80mm;
            max-width: 80mm;
            margin: 0;
            padding: 6px;
            box-sizing: border-box;
            font-family: ui-monospace, monospace;
            font-size: 24px;
            line-height: 1.2;
            color: #000;
            text-transform: uppercase;
          }
          .title { font-weight: bold; font-size: 32px; line-height: 1.1; margin-bottom: 10px; }
          .line { margin: 5px 0; overflow-wrap: break-word; word-break: normal; }
          .sep { border-top: 2px dashed #000; margin: 10px 0; }
        </style>
      </head>
      <body>${bodyHtml}
      </body>
    </html>
  `);
  opened.document.close();
  opened.focus();
  opened.print();
  opened.close();
  return true;
}

export default function CozinhaPage() {
  const [itens, setItens] = useState<ItemCozinha[]>([]);
  const [filtro, setFiltro] = useState<"pendentes" | "impressos" | "finalizados">("pendentes");
  const [busca, setBusca] = useState("");
  const [openGrupoKey, setOpenGrupoKey] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/cozinha?filtro=${filtro}&data=${selectedDate}`, {
        cache: "no-store"
      });
      const payload = (await response.json()) as { itens?: ItemCozinha[]; message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "Erro ao carregar cozinha.");
      }
      setItens(payload.itens ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar cozinha.");
    } finally {
      setLoading(false);
    }
  }, [filtro, selectedDate]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void carregar();
    }, 10000);
    return () => window.clearInterval(intervalId);
  }, [carregar]);

  const itensFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return itens;
    return itens.filter((item) =>
      `${item.pedidoNumero} ${item.mesaNumero} ${item.pessoaNome} ${item.categoriaNome} ${item.produtoNome} ${item.observacao ?? ""}`
        .toLowerCase()
        .includes(termo)
    );
  }, [itens, busca]);

  const grupos = itensFiltrados.reduce<GrupoCozinha[]>((acc, item) => {
    const key = `${item.atendimentoTipo}::${item.pedidoNumero}::${item.pessoaNome}`;
    const existing = acc.find((group) => group.key === key);
    if (existing) {
      existing.itens.push(item);
      return acc;
    }
    acc.push({
      key,
      mesaNumero: item.mesaNumero,
      pessoaNome: item.pessoaNome,
      pedidoNumero: item.pedidoNumero,
      itens: [item]
    });
    return acc;
  }, []);

  const itensDoMesmoPedidoPessoa = useCallback(
    (item: ItemCozinha) =>
      itens.filter(
        (i) =>
          i.atendimentoTipo === item.atendimentoTipo &&
          i.pedidoNumero === item.pedidoNumero &&
          i.pessoaNome === item.pessoaNome
      ),
    [itens]
  );

  function operacaoEmAndamentoParaItem(item: ItemCozinha, op: string | null) {
    if (!op) return false;
    if (op === `fin:${item.itemId}`) return true;
    return op === `print-grupo|${grupoKeyFromItem(item)}`;
  }

  function operacaoEmAndamentoParaGrupo(grupo: GrupoCozinha, op: string | null) {
    return op === `print-grupo|${grupo.key}`;
  }

  async function handleImprimirGrupo(grupo: GrupoCozinha) {
    const first = grupo.itens[0];
    if (!first) return;
    const batch = itensDoMesmoPedidoPessoa(first);
    setProcessingId(`print-grupo|${grupo.key}`);

    const printed = printTicket80mm(batch);
    if (!printed) {
      setProcessingId(null);
      setError("Não foi possível abrir janela de impressão.");
      return;
    }
    try {
      for (const i of batch) {
        if (!i.impresso) {
          const response = await fetch("/api/cozinha", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ itemId: i.itemId })
          });
          const payload = (await response.json()) as { message?: string };
          if (!response.ok) {
            throw new Error(payload.message ?? "Erro ao marcar item como impresso.");
          }
        }
      }
      await carregar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao marcar item.");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleFinalizar(item: ItemCozinha) {
    setProcessingId(`fin:${item.itemId}`);
    try {
      const response = await fetch("/api/cozinha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.itemId, acao: "finalizar" })
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "Erro ao finalizar item.");
      }
      await carregar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao finalizar item.");
    } finally {
      setProcessingId(null);
    }
  }

  if (loading) {
    return <main className="p-6">Carregando cozinha...</main>;
  }

  return (
    <main className="mx-auto max-w-7xl p-4 md:p-6">
      <AppShell
        title="Cozinha"
        subtitle={`${filtro === "pendentes" ? "Pendentes" : filtro === "impressos" ? "Na cozinha" : "Finalizados"}: ${itensFiltrados.length} item(ns)`}
      >
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <section className="mb-3 flex gap-2">
          <button
            type="button"
            onClick={() => setFiltro("pendentes")}
            className={`rounded-lg px-3 py-1.5 text-sm ${filtro === "pendentes" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
          >
            Pendentes
          </button>
          <button
            type="button"
            onClick={() => setFiltro("impressos")}
            className={`rounded-lg px-3 py-1.5 text-sm ${filtro === "impressos" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
          >
            Na cozinha
          </button>
          <button
            type="button"
            onClick={() => setFiltro("finalizados")}
            className={`rounded-lg px-3 py-1.5 text-sm ${filtro === "finalizados" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
          >
            Finalizados
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="ui-input"
          />
          <input
            type="search"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Filtrar por mesa, pedido, pessoa ou item..."
            className="ui-input min-w-[280px]"
          />
        </section>

        <section className="space-y-3">
          {grupos.map((grupo) => (
            <article key={grupo.key} className="ui-card p-4">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <button
                  type="button"
                  onClick={() =>
                    setOpenGrupoKey((current) => (current === grupo.key ? null : grupo.key))
                  }
                  className="min-w-0 flex-1 rounded-lg text-left ring-offset-2 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                >
                  <p className="text-sm font-semibold">
                    {grupo.itens[0]?.atendimentoTipo === "delivery"
                      ? `Delivery | Pedido #${grupo.pedidoNumero}`
                      : `Mesa ${grupo.mesaNumero} | Pedido #${grupo.pedidoNumero}`}
                  </p>
                  <p className="text-sm text-slate-600">{grupo.pessoaNome}</p>
                  <span className="mt-1 inline-block text-xs text-slate-500">
                    {openGrupoKey === grupo.key ? "fechar detalhes" : "abrir detalhes"}
                  </span>
                </button>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={operacaoEmAndamentoParaGrupo(grupo, processingId)}
                    onClick={() => void handleImprimirGrupo(grupo)}
                    className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {operacaoEmAndamentoParaGrupo(grupo, processingId)
                      ? "Imprimindo..."
                      : grupo.itens.every((i) => i.impresso)
                        ? "Reimprimir pedido"
                        : "Imprimir pedido"}
                  </button>
                </div>
              </div>

              {openGrupoKey === grupo.key ? (
                <div className="space-y-2">
                  {grupo.itens.map((item) => (
                    <div
                      key={item.itemId}
                      className="ui-info flex items-center justify-between gap-2"
                    >
                      <div>
                        <p className="ui-info-value">
                          {item.quantidade}x {getNomeItemComCategoria(item)}
                        </p>
                        <p className="text-xs text-slate-600">Obs: {item.observacao ?? "-"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.finalizado ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-800">
                            Finalizado
                          </span>
                        ) : null}
                        {filtro === "impressos" && !item.finalizado ? (
                          <button
                            type="button"
                            disabled={operacaoEmAndamentoParaItem(item, processingId)}
                            onClick={() => void handleFinalizar(item)}
                            className="rounded-lg bg-white px-3 py-2 text-sm text-slate-900 shadow-sm disabled:opacity-60"
                          >
                            Finalizar
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </article>
          ))}

          {grupos.length === 0 ? (
            <section className="ui-card p-5 text-center text-sm text-slate-600">
              Nenhum item encontrado para o filtro aplicado.
            </section>
          ) : null}
        </section>
      </AppShell>
    </main>
  );
}
