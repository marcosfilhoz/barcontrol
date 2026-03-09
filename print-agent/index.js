const net = require("net");
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PRINTER_HOST = process.env.PRINTER_HOST;
const PRINTER_PORT = Number(process.env.PRINTER_PORT || "9100");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !PRINTER_HOST) {
  console.error("Variaveis faltando. Confira .env e reinicie o agente.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

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

async function markPrinted(itemId) {
  const { error } = await supabase
    .from("pedido_itens")
    .update({ impresso: true })
    .eq("id", itemId);
  if (error) {
    console.error("Erro ao atualizar item como impresso:", error.message);
  }
}

async function hydrateItem(itemId) {
  const { data, error } = await supabase
    .from("pedido_itens")
    .select(
      "id, quantidade, observacao, impresso, produtos(nome, preco, setor_impressao), pessoas_mesa(nome)"
    )
    .eq("id", itemId)
    .single();
  if (error) {
    throw new Error(error.message);
  }
  return data;
}

function buildTicketLine(item) {
  const produtoNome = item.produtos?.nome || "Produto";
  const setor = item.produtos?.setor_impressao || "cozinha";
  const pessoa = item.pessoas_mesa?.nome || "Sem nome";
  const qtd = item.quantidade || 1;
  const preco = formatCurrency(item.produtos?.preco);
  const obs = item.observacao ? `Obs: ${item.observacao}\n` : "";

  return [
    "======== NOVO ITEM ========",
    `Setor: ${setor}`,
    `Pessoa: ${pessoa}`,
    `Item: ${produtoNome}`,
    `Qtd: ${qtd}  Preco: R$ ${preco}`,
    obs.trim(),
    "===========================",
    ""
  ]
    .filter(Boolean)
    .join("\n");
}

async function processItemInsert(itemId) {
  try {
    const item = await hydrateItem(itemId);
    if (item.impresso) return;
    const ticket = buildTicketLine(item);
    await sendToPrinter(`${ticket}\n`);
    await markPrinted(itemId);
    console.log(`Item ${itemId} impresso com sucesso.`);
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
        if (!item || item.impresso) return;
        await processItemInsert(item.id);
      }
    )
    .subscribe((status) => {
      console.log("Realtime status:", status);
    });

  console.log(`Print Agent ouvindo inserts de pedido_itens para ${PRINTER_HOST}:${PRINTER_PORT}`);

  process.on("SIGINT", async () => {
    await supabase.removeChannel(channel);
    process.exit(0);
  });
}

startRealtimeListener();
