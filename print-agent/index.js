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

/**
 * Itens pendentes da mesma pessoa na mesa (comanda = mesmo bloco Pedido + Pessoa na cozinha web).
 */
async function fetchPendingItemsForPessoa(pessoaId) {
  const { data: itens, error } = await supabase
    .from("pedido_itens")
    .select(
      "id, quantidade, observacao, impresso, finalizado, produtos(nome, preco, setor_impressao), pessoas_mesa(nome, pedido_id)"
    )
    .eq("pessoa_id", pessoaId)
    .eq("impresso", false);

  if (error) {
    console.error("Erro ao buscar itens pendentes:", error.message);
    return [];
  }

  const rows = (itens ?? []).filter((r) => !r.finalizado);
  if (rows.length === 0) return [];

  const pedidoId = rows[0].pessoas_mesa?.pedido_id;
  let _pedidoNumero = null;
  let _mesaNumero = "?";
  if (pedidoId) {
    const { data: ped } = await supabase
      .from("pedidos")
      .select("numero, mesa_id")
      .eq("id", pedidoId)
      .maybeSingle();
    _pedidoNumero = ped?.numero ?? null;
    if (ped?.mesa_id) {
      const { data: mesa } = await supabase
        .from("mesas")
        .select("numero")
        .eq("id", ped.mesa_id)
        .maybeSingle();
      if (mesa?.numero != null) _mesaNumero = mesa.numero;
    }
  }

  return rows.map((r) => ({ ...r, _pedidoNumero, _mesaNumero }));
}

function sortItemsForTicket(a, b) {
  return String(a.id).localeCompare(String(b.id));
}

function buildCombinedTicket(items) {
  const sorted = [...items].sort(sortItemsForTicket);
  const head = sorted[0];
  const mesaNumero = head._mesaNumero ?? "?";
  const pedidoN = head._pedidoNumero != null ? String(head._pedidoNumero) : "?";
  const pessoa = head.pessoas_mesa?.nome || "Sem nome";

  const lines = [
    "======== COZINHA ========",
    `MESA ${mesaNumero}`,
    `PEDIDO #${pedidoN}`,
    `PESSOA: ${pessoa}`,
    `ITENS: ${sorted.length}`,
    "-------------------------"
  ];

  for (const item of sorted) {
    const produtoNome = item.produtos?.nome || "Produto";
    const setor = item.produtos?.setor_impressao || "cozinha";
    const qtd = item.quantidade || 1;
    const preco = formatCurrency(item.produtos?.preco);
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

function schedulePessoaFlush(pessoaId) {
  if (debouncers.has(pessoaId)) {
    clearTimeout(debouncers.get(pessoaId));
  }
  const t = setTimeout(() => {
    debouncers.delete(pessoaId);
    void flushPessoaPrint(pessoaId);
  }, DEBOUNCE_MS);
  debouncers.set(pessoaId, t);
}

async function flushPessoaPrint(pessoaId) {
  try {
    const items = await fetchPendingItemsForPessoa(pessoaId);
    if (items.length === 0) return;

    const ticket = buildCombinedTicket(items);
    await sendToPrinter(ticket);
    await markPrintedBulk(items.map((i) => i.id));
    const mesa = items[0]._mesaNumero ?? "?";
    console.log(
      `Comanda (pessoa ${pessoaId.slice(0, 8)}…): mesa ${mesa}, ${items.length} item(ns) em um cupom.`
    );
  } catch (err) {
    console.error("Falha ao imprimir lote da comanda:", err.message || err);
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
  console.log(`Item ${item.id} impresso (fallback sem pessoa_id).`);
}

async function processItemInsert(row) {
  if (!row || row.impresso) return;

  if (row.pessoa_id) {
    schedulePessoaFlush(row.pessoa_id);
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
  console.log(
    `Agrupamento por comanda (pessoa na mesa): debounce ${DEBOUNCE_MS}ms, caixa alta + ESC/POS maior.`
  );

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
