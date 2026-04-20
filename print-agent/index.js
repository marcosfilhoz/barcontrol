const net = require("net");
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PRINTER_HOST = process.env.PRINTER_HOST;
const PRINTER_PORT = Number(process.env.PRINTER_PORT || "9100");
const DEBOUNCE_MS = Number(process.env.PRINT_DEBOUNCE_MS || "450");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !PRINTER_HOST) {
  console.error("Variaveis faltando. Confira .env e reinicie o agente.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

/** ESC/POS: init, double width+height, restore normal */
const ESC_INIT = "\x1B\x40";
const ESC_DOUBLE = "\x1B!\x30";
const ESC_NORMAL = "\x1B!\x00";

const debouncers = new Map();

function formatCurrency(value) {
  return Number(value || 0).toFixed(2).replace(".", ",");
}

function sendToPrinter(text) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    socket.connect(PRINTER_PORT, PRINTER_HOST, () => {
      socket.write(text, "utf8", () => {
        socket.end();
        resolve();
      });
    });
    socket.on("error", (err) => reject(err));
  });
}

async function markPrintedBulk(itemIds) {
  if (itemIds.length === 0) return;
  const { error } = await supabase.from("pedido_itens").update({ impresso: true }).in("id", itemIds);
  if (error) {
    console.error("Erro ao marcar itens como impressos:", error.message);
    throw error;
  }
}

async function getMesaIdFromPessoaId(pessoaId) {
  const { data: pm, error } = await supabase
    .from("pessoas_mesa")
    .select("pedido_id")
    .eq("id", pessoaId)
    .maybeSingle();
  if (error || !pm?.pedido_id) return null;
  const { data: ped, error: e2 } = await supabase
    .from("pedidos")
    .select("mesa_id")
    .eq("id", pm.pedido_id)
    .maybeSingle();
  if (e2 || !ped?.mesa_id) return null;
  return ped.mesa_id;
}

async function fetchMesaNumero(mesaId) {
  const { data } = await supabase.from("mesas").select("numero").eq("id", mesaId).maybeSingle();
  return data?.numero ?? "?";
}

/**
 * Todos os itens do pedido aberto da mesa ainda nao impressos (e nao finalizados).
 */
async function fetchPendingItemsForMesa(mesaId) {
  const { data: pedidos, error } = await supabase
    .from("pedidos")
    .select("id")
    .eq("mesa_id", mesaId)
    .eq("status", "aberto");
  if (error || !pedidos?.length) return [];

  const pedidoIds = pedidos.map((p) => p.id);
  const { data: pessoas, error: pErr } = await supabase
    .from("pessoas_mesa")
    .select("id")
    .in("pedido_id", pedidoIds)
    .is("fechado_em", null);
  if (pErr || !pessoas?.length) return [];

  const pessoaIds = pessoas.map((p) => p.id);
  const { data: itens, error: iErr } = await supabase
    .from("pedido_itens")
    .select(
      "id, quantidade, observacao, impresso, finalizado, produtos(nome, preco, setor_impressao), pessoas_mesa(nome, pedido_id)"
    )
    .in("pessoa_id", pessoaIds)
    .eq("impresso", false);
  if (iErr) {
    console.error("Erro ao buscar itens pendentes:", iErr.message);
    return [];
  }

  const rows = itens ?? [];
  const pedidoIdSet = [...new Set(rows.map((r) => r.pessoas_mesa?.pedido_id).filter(Boolean))];
  let pedidoNumeros = new Map();
  if (pedidoIdSet.length > 0) {
    const { data: peds } = await supabase.from("pedidos").select("id, numero").in("id", pedidoIdSet);
    for (const p of peds ?? []) {
      pedidoNumeros.set(p.id, p.numero);
    }
  }

  return rows
    .filter((r) => !r.finalizado)
    .map((r) => ({
      ...r,
      _pedidoNumero: r.pessoas_mesa?.pedido_id ? pedidoNumeros.get(r.pessoas_mesa.pedido_id) : null
    }));
}

function sortItemsForTicket(a, b) {
  const pa = a._pedidoNumero ?? 0;
  const pb = b._pedidoNumero ?? 0;
  if (pa !== pb) return pa - pb;
  const na = a.pessoas_mesa?.nome || "";
  const nb = b.pessoas_mesa?.nome || "";
  if (na !== nb) return na.localeCompare(nb, "pt-BR");
  return String(a.id).localeCompare(String(b.id));
}

function buildCombinedTicket(items, mesaNumero) {
  const sorted = [...items].sort(sortItemsForTicket);
  const lines = [
    "======== COZINHA ========",
    `MESA ${mesaNumero}`,
    `ITENS: ${sorted.length}`,
    "-------------------------"
  ];

  for (const item of sorted) {
    const produtoNome = item.produtos?.nome || "Produto";
    const setor = item.produtos?.setor_impressao || "cozinha";
    const pessoa = item.pessoas_mesa?.nome || "Sem nome";
    const qtd = item.quantidade || 1;
    const preco = formatCurrency(item.produtos?.preco);
    const pedidoN = item._pedidoNumero != null ? String(item._pedidoNumero) : "?";
    lines.push(`PEDIDO #${pedidoN}`);
    lines.push(`PESSOA: ${pessoa}`);
    lines.push(`SETOR: ${setor}`);
    lines.push(`ITEM: ${produtoNome}`);
    lines.push(`QTD: ${qtd}  PRECO: R$ ${preco}`);
    if (item.observacao) {
      lines.push(`OBS: ${item.observacao}`);
    }
    lines.push("-------------------------");
  }
  lines.push("BARCONTROL");
  lines.push("");

  const body = lines.join("\n").toUpperCase();
  return `${ESC_INIT}${ESC_DOUBLE}${body}\n${ESC_NORMAL}`;
}

function scheduleMesaFlush(mesaId) {
  if (debouncers.has(mesaId)) {
    clearTimeout(debouncers.get(mesaId));
  }
  const t = setTimeout(() => {
    debouncers.delete(mesaId);
    void flushMesaPrint(mesaId);
  }, DEBOUNCE_MS);
  debouncers.set(mesaId, t);
}

async function flushMesaPrint(mesaId) {
  try {
    const items = await fetchPendingItemsForMesa(mesaId);
    if (items.length === 0) return;

    const mesaNumero = await fetchMesaNumero(mesaId);
    const ticket = buildCombinedTicket(items, mesaNumero);
    await sendToPrinter(ticket);
    await markPrintedBulk(items.map((i) => i.id));
    console.log(`Mesa ${mesaNumero}: ${items.length} item(ns) impresso(s) em um unico cupom.`);
  } catch (err) {
    console.error("Falha ao imprimir lote da mesa:", err.message || err);
  }
}

async function hydrateItem(itemId) {
  const { data, error } = await supabase
    .from("pedido_itens")
    .select(
      "id, quantidade, observacao, impresso, finalizado, produtos(nome, preco, setor_impressao), pessoas_mesa(nome, pedido_id)"
    )
    .eq("id", itemId)
    .single();
  if (error) {
    throw new Error(error.message);
  }
  return data;
}

async function printSingleItemFallback(item) {
  if (item.impresso || item.finalizado) return;
  const pedidoId = item.pessoas_mesa?.pedido_id;
  let pedidoNum = "?";
  if (pedidoId) {
    const { data: ped } = await supabase.from("pedidos").select("numero").eq("id", pedidoId).maybeSingle();
    if (ped?.numero != null) pedidoNum = String(ped.numero);
  }
  const produtoNome = item.produtos?.nome || "Produto";
  const setor = item.produtos?.setor_impressao || "cozinha";
  const pessoa = item.pessoas_mesa?.nome || "Sem nome";
  const qtd = item.quantidade || 1;
  const preco = formatCurrency(item.produtos?.preco);
  const obs = item.observacao ? `OBS: ${item.observacao}\n` : "";
  const lines = [
    "======== NOVO ITEM ========",
    `SETOR: ${setor}`,
    `PEDIDO #${pedidoNum}`,
    `PESSOA: ${pessoa}`,
    `ITEM: ${produtoNome}`,
    `QTD: ${qtd}  PRECO: R$ ${preco}`,
    obs.trim(),
    "===========================",
    ""
  ]
    .filter(Boolean)
    .join("\n");

  const ticket = `${ESC_INIT}${ESC_DOUBLE}${lines.toUpperCase()}\n${ESC_NORMAL}`;
  await sendToPrinter(ticket);
  await markPrintedBulk([item.id]);
  console.log(`Item ${item.id} impresso (fallback sem mesa).`);
}

async function processItemInsert(row) {
  if (!row || row.impresso) return;

  const mesaId = await getMesaIdFromPessoaId(row.pessoa_id);
  if (mesaId) {
    scheduleMesaFlush(mesaId);
    return;
  }

  try {
    const item = await hydrateItem(row.id);
    await printSingleItemFallback(item);
  } catch (err) {
    console.error("Falha ao processar item:", err.message || err);
  }
}

function startRealtimeListener() {
  const channel = supabase
    .channel("print-agent-pedido-itens")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "pedido_itens" },
      async (payload) => {
        const item = payload.new;
        await processItemInsert(item);
      }
    )
    .subscribe((status) => {
      console.log("Realtime status:", status);
    });

  console.log(`Print Agent ouvindo inserts de pedido_itens para ${PRINTER_HOST}:${PRINTER_PORT}`);
  console.log(`Agrupamento por mesa: debounce ${DEBOUNCE_MS}ms, texto em caixa alta + tamanho ESC/POS maior.`);

  process.on("SIGINT", async () => {
    for (const t of debouncers.values()) {
      clearTimeout(t);
    }
    debouncers.clear();
    await supabase.removeChannel(channel);
    process.exit(0);
  });
}

startRealtimeListener();
