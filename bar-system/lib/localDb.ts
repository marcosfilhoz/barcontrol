import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

type Perfil = "admin" | "garcom" | "caixa";
type MesaStatus = "livre" | "ocupada" | "fechando";
type PedidoStatus = "aberto" | "fechado";
type DeliveryStatus = "aberto" | "fechado" | "cancelado";
export type TipoPagamento = "dinheiro" | "pix" | "cartao_credito" | "cartao_debito";

export type Mesa = { id: string; numero: number; status: MesaStatus };
export type Pedido = {
  id: string;
  numero: number;
  mesa_id: string;
  aberto_em: string;
  fechado_em: string | null;
  status: PedidoStatus;
};
export type PessoaMesa = { id: string; pedido_id: string; nome: string; fechado_em: string | null };
export type Categoria = { id: string; nome: string };
export type Produto = {
  id: string;
  nome: string;
  preco: number;
  categoria_id: string;
  setor_impressao: string | null;
};
export type PedidoItem = {
  id: string;
  pessoa_id: string;
  produto_id: string;
  quantidade: number;
  observacao: string | null;
  impresso: boolean;
  criado_em: string;
  finalizado?: boolean;
};
export type DeliveryPedido = {
  id: string;
  numero: number;
  nome_cliente: string;
  endereco_entrega: string;
  telefone: string;
  tipo_pagamento: TipoPagamento;
  aberto_em: string;
  fechado_em: string | null;
  status: DeliveryStatus;
};
export type DeliveryItem = {
  id: string;
  delivery_id: string;
  produto_id: string;
  quantidade: number;
  observacao: string | null;
  impresso: boolean;
  criado_em: string;
  finalizado?: boolean;
};
export type Operador = {
  id: string;
  nome: string;
  login: string;
  senha: string;
  perfil: Perfil;
  ativo: boolean;
};

type LocalDb = {
  mesas: Mesa[];
  pedidos: Pedido[];
  pessoas_mesa: PessoaMesa[];
  categorias: Categoria[];
  produtos: Produto[];
  pedido_itens: PedidoItem[];
  delivery_pedidos: DeliveryPedido[];
  delivery_itens: DeliveryItem[];
  operadores: Operador[];
};

const DB_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DB_DIR, "local-db.json");

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function seedDatabase(): LocalDb {
  const mesas: Mesa[] = Array.from({ length: 30 }, (_, index) => ({
    id: `mesa_${index + 1}`,
    numero: index + 1,
    status: "livre"
  }));

  const categorias: Categoria[] = [
    { id: "cat_bebidas", nome: "Bebidas" },
    { id: "cat_porcoes", nome: "Porções" },
    { id: "cat_pratos", nome: "Pratos" }
  ];

  const produtos: Produto[] = [
    { id: "prod_cerveja", nome: "Cerveja", preco: 12, categoria_id: "cat_bebidas", setor_impressao: "bar" },
    { id: "prod_refri", nome: "Refrigerante", preco: 8, categoria_id: "cat_bebidas", setor_impressao: "bar" },
    { id: "prod_batata", nome: "Batata Frita", preco: 25, categoria_id: "cat_porcoes", setor_impressao: "cozinha" },
    { id: "prod_calabresa", nome: "Calabresa", preco: 32, categoria_id: "cat_porcoes", setor_impressao: "cozinha" },
    { id: "prod_picanha", nome: "Picanha", preco: 74.9, categoria_id: "cat_pratos", setor_impressao: "cozinha" }
  ];

  return {
    mesas,
    pedidos: [],
    pessoas_mesa: [],
    categorias,
    produtos,
    pedido_itens: [],
    delivery_pedidos: [],
    delivery_itens: [],
    operadores: [
      {
        id: "op_admin",
        nome: "Administrador",
        login: "admin",
        senha: "admin",
        perfil: "admin",
        ativo: true
      }
    ]
  };
}

async function ensureDbFile(): Promise<void> {
  await fs.mkdir(DB_DIR, { recursive: true });
  try {
    await fs.access(DB_FILE);
  } catch {
    const seeded = seedDatabase();
    await fs.writeFile(DB_FILE, JSON.stringify(seeded, null, 2), "utf8");
  }
}

async function readDb(): Promise<LocalDb> {
  try {
    await fs.mkdir(DB_DIR, { recursive: true });
  } catch {
    return seedDatabase();
  }
  let content: string;
  try {
    content = await fs.readFile(DB_FILE, "utf8");
  } catch {
    const seeded = seedDatabase();
    try {
      await fs.writeFile(DB_FILE, JSON.stringify(seeded, null, 2), "utf8");
    } catch {
      // ignore write error
    }
    return seeded;
  }
  let db: LocalDb;
  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== "object") return seedDatabase();
    db = parsed as LocalDb;
  } catch {
    const fallback = seedDatabase();
    try {
      await fs.writeFile(DB_FILE, JSON.stringify(fallback, null, 2), "utf8");
    } catch {
      // ignore
    }
    return fallback;
  }
  let changed = false;
  if (!Array.isArray(db.delivery_pedidos)) {
    db.delivery_pedidos = [];
    changed = true;
  }
  if (!Array.isArray(db.delivery_itens)) {
    db.delivery_itens = [];
    changed = true;
  }
  for (const item of db.pedido_itens ?? []) {
    if (!item.criado_em) {
      item.criado_em = new Date().toISOString();
      changed = true;
    }
    if (typeof item.finalizado === "undefined") {
      item.finalizado = false;
      changed = true;
    }
  }
  for (const item of db.delivery_itens ?? []) {
    if (!item.criado_em) {
      item.criado_em = new Date().toISOString();
      changed = true;
    }
    if (typeof item.finalizado === "undefined") {
      item.finalizado = false;
      changed = true;
    }
  }
  for (const pessoa of db.pessoas_mesa ?? []) {
    if (typeof pessoa.fechado_em === "undefined") {
      pessoa.fechado_em = null;
      changed = true;
    }
  }
  if (changed) {
    try {
      await writeDb(db);
    } catch {
      // ignore
    }
  }
  return db;
}

async function writeDb(db: LocalDb): Promise<void> {
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2), "utf8");
}

function findOrCreateOpenPedido(db: LocalDb, mesaId: string): Pedido {
  const existing = db.pedidos.find((pedido) => pedido.mesa_id === mesaId && pedido.status === "aberto");
  if (existing) {
    if (!existing.numero) {
      existing.numero = getNextPedidoNumero(db);
    }
    return existing;
  }

  const pedido: Pedido = {
    id: newId("ped"),
    numero: getNextPedidoNumero(db),
    mesa_id: mesaId,
    aberto_em: new Date().toISOString(),
    fechado_em: null,
    status: "aberto"
  };
  db.pedidos.push(pedido);
  return pedido;
}

function getNextPedidoNumero(db: LocalDb): number {
  const maxMesa = (db.pedidos ?? []).reduce((max, pedido) => Math.max(max, pedido.numero ?? 0), 0);
  const deliveryPedidos = Array.isArray(db.delivery_pedidos) ? db.delivery_pedidos : [];
  const maxDelivery = deliveryPedidos.reduce(
    (max, pedido) => Math.max(max, pedido.numero ?? 0),
    0
  );
  return Math.max(maxMesa, maxDelivery) + 1;
}

export async function authOperador(login: string, senha: string): Promise<Operador | null> {
  const db = await readDb();
  // Compat: converte perfil antigo "caixa" para "admin" no modo local.
  for (const operador of db.operadores) {
    if (operador.perfil === "caixa") {
      operador.perfil = "admin";
    }
  }
  await writeDb(db);
  return (
    db.operadores.find(
      (operador) => operador.login === login && operador.senha === senha && operador.ativo
    ) ?? null
  );
}

export async function listOperadores(): Promise<
  Array<{ id: string; nome: string; login: string; perfil: "admin" | "garcom"; ativo: boolean }>
> {
  const db = await readDb();
  const normalized = db.operadores.map((operador) => ({
    ...operador,
    perfil: operador.perfil === "caixa" ? "admin" : operador.perfil
  }));
  return normalized
    .filter((operador) => operador.perfil === "admin" || operador.perfil === "garcom")
    .sort((a, b) => a.nome.localeCompare(b.nome))
    .map((operador) => ({
      id: operador.id,
      nome: operador.nome,
      login: operador.login,
      perfil: operador.perfil as "admin" | "garcom",
      ativo: operador.ativo
    }));
}

export async function updateOperador(
  operadorId: string,
  input: { nome: string; login: string; perfil: "admin" | "garcom"; senha?: string }
): Promise<void> {
  const db = await readDb();
  const operador = db.operadores.find((item) => item.id === operadorId);
  if (!operador) {
    throw new Error("Usuário não encontrado.");
  }
  const newLogin = input.login.trim().toLowerCase();
  if (
    db.operadores.some(
      (item) => item.id !== operadorId && item.login.trim().toLowerCase() === newLogin
    )
  ) {
    throw new Error("Login ja existe.");
  }
  operador.nome = input.nome.trim();
  operador.login = newLogin;
  operador.perfil = input.perfil;
  if (input.senha && input.senha.trim()) {
    operador.senha = input.senha.trim();
  }
  await writeDb(db);
}

export async function deleteOperador(operadorId: string): Promise<void> {
  const db = await readDb();
  db.operadores = db.operadores.filter((item) => item.id !== operadorId);
  await writeDb(db);
}

export async function createOperador(input: {
  nome: string;
  login: string;
  senha: string;
  perfil: "admin" | "garcom";
}): Promise<void> {
  const db = await readDb();
  const login = input.login.trim().toLowerCase();
  if (db.operadores.some((operador) => operador.login.toLowerCase() === login)) {
    throw new Error("Login ja existe.");
  }

  db.operadores.push({
    id: newId("op"),
    nome: input.nome.trim(),
    login,
    senha: input.senha.trim(),
    perfil: input.perfil,
    ativo: true
  });
  await writeDb(db);
}

export async function listMesas(): Promise<Mesa[]> {
  const db = await readDb();
  return [...db.mesas].sort((a, b) => a.numero - b.numero);
}

export async function listCategorias(): Promise<Categoria[]> {
  const db = await readDb();
  return [...db.categorias].sort((a, b) => a.nome.localeCompare(b.nome));
}

export async function createCategoria(nome: string): Promise<Categoria> {
  const db = await readDb();
  const normalized = nome.trim();
  if (!normalized) {
    throw new Error("Nome da categoria obrigatório.");
  }
  if (
    db.categorias.some(
      (categoria) => categoria.nome.trim().toLowerCase() === normalized.toLowerCase()
    )
  ) {
    throw new Error("Categoria ja existe.");
  }

  const categoria: Categoria = {
    id: newId("cat"),
    nome: normalized
  };
  db.categorias.push(categoria);
  await writeDb(db);
  return categoria;
}

export async function updateCategoria(categoriaId: string, nome: string): Promise<void> {
  const db = await readDb();
  const categoria = db.categorias.find((item) => item.id === categoriaId);
  if (!categoria) {
    throw new Error("Categoria não encontrada.");
  }
  categoria.nome = nome.trim();
  await writeDb(db);
}

export async function deleteCategoria(categoriaId: string): Promise<void> {
  const db = await readDb();
  const hasProduto = db.produtos.some((produto) => produto.categoria_id === categoriaId);
  if (hasProduto) {
    throw new Error("Não é possível excluir categoria com produtos vinculados.");
  }
  db.categorias = db.categorias.filter((item) => item.id !== categoriaId);
  await writeDb(db);
}

export async function listProdutosWithCategoria(): Promise<
  Array<{
    id: string;
    nome: string;
    preco: number;
    categoria: string;
    setor_impressao: string | null;
  }>
> {
  const db = await readDb();
  return db.produtos
    .map((produto) => {
      const categoria = db.categorias.find((item) => item.id === produto.categoria_id)?.nome ?? "Sem categoria";
      return {
        id: produto.id,
        nome: produto.nome,
        preco: produto.preco,
        categoria,
        setor_impressao: produto.setor_impressao
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

export async function createProduto(input: {
  nome: string;
  preco: number;
  categoriaId: string;
  setorImpressao?: "cozinha" | "bar" | null;
}): Promise<Produto> {
  const db = await readDb();
  const categoria = db.categorias.find((item) => item.id === input.categoriaId);
  if (!categoria) {
    throw new Error("Categoria inválida.");
  }

  const produto: Produto = {
    id: newId("prod"),
    nome: input.nome.trim(),
    preco: input.preco,
    categoria_id: input.categoriaId,
    setor_impressao: input.setorImpressao ?? null
  };
  db.produtos.push(produto);
  await writeDb(db);
  return produto;
}

export async function updateProduto(
  produtoId: string,
  input: { nome: string; preco: number; categoriaId: string; setorImpressao?: "cozinha" | "bar" | null }
): Promise<void> {
  const db = await readDb();
  const produto = db.produtos.find((item) => item.id === produtoId);
  if (!produto) {
    throw new Error("Produto não encontrado.");
  }
  const categoria = db.categorias.find((item) => item.id === input.categoriaId);
  if (!categoria) {
    throw new Error("Categoria inválida.");
  }
  produto.nome = input.nome.trim();
  produto.preco = input.preco;
  produto.categoria_id = input.categoriaId;
  produto.setor_impressao = input.setorImpressao ?? null;
  await writeDb(db);
}

export async function deleteProduto(produtoId: string): Promise<void> {
  const db = await readDb();
  const hasItem = db.pedido_itens.some((item) => item.produto_id === produtoId);
  if (hasItem) {
    throw new Error("Não é possível excluir produto já usado em pedidos.");
  }
  db.produtos = db.produtos.filter((item) => item.id !== produtoId);
  await writeDb(db);
}

export async function listCozinhaItens(
  filtro: "pendentes" | "impressos" | "finalizados" | "todos" = "pendentes",
  data?: string
): Promise<
  Array<{
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
  }>
> {
  const db = await readDb();
  const rows: Array<{
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
  }> = [];

  for (const item of db.pedido_itens ?? []) {
    if (filtro === "pendentes" && (item.impresso || item.finalizado)) continue;
    if (filtro === "impressos" && (!item.impresso || item.finalizado)) continue;
    if (filtro === "finalizados" && !item.finalizado) continue;
    if (data && (item.criado_em ?? "").slice(0, 10) !== data) continue;
    const produto = (db.produtos ?? []).find((prod) => prod.id === item.produto_id);
    if (!produto || produto.setor_impressao !== "cozinha") continue;
    const categoria = (db.categorias ?? []).find((cat) => cat.id === produto.categoria_id);
    const pessoa = (db.pessoas_mesa ?? []).find((pes) => pes.id === item.pessoa_id);
    if (!pessoa || pessoa.fechado_em) continue;
    const pedido = (db.pedidos ?? []).find((ped) => ped.id === pessoa.pedido_id && ped.status === "aberto");
    if (!pedido) continue;
    const mesa = (db.mesas ?? []).find((m) => m.id === pedido.mesa_id);
    if (!mesa) continue;

    rows.push({
      itemId: item.id,
      mesaNumero: mesa.numero,
      pessoaNome: pessoa.nome,
      categoriaNome: categoria?.nome ?? "Sem categoria",
      produtoNome: produto.nome,
      quantidade: item.quantidade,
      observacao: item.observacao,
      pedidoNumero: pedido.numero,
      impresso: item.impresso,
      finalizado: item.finalizado ?? false,
      atendimentoTipo: "mesa"
    });
  }

  for (const item of db.delivery_itens ?? []) {
    if (filtro === "pendentes" && (item.impresso || item.finalizado)) continue;
    if (filtro === "impressos" && (!item.impresso || item.finalizado)) continue;
    if (filtro === "finalizados" && !item.finalizado) continue;
    if (data && (item.criado_em ?? "").slice(0, 10) !== data) continue;
    const produto = (db.produtos ?? []).find((prod) => prod.id === item.produto_id);
    if (!produto || produto.setor_impressao !== "cozinha") continue;
    const categoria = (db.categorias ?? []).find((cat) => cat.id === produto.categoria_id);
    const pedido = (db.delivery_pedidos ?? []).find((ped) => ped.id === item.delivery_id && ped.status === "aberto");
    if (!pedido) continue;

    rows.push({
      itemId: item.id,
      mesaNumero: 0,
      pessoaNome: pedido.nome_cliente,
      categoriaNome: categoria?.nome ?? "Sem categoria",
      produtoNome: produto.nome,
      quantidade: item.quantidade,
      observacao: item.observacao,
      pedidoNumero: pedido.numero,
      impresso: item.impresso,
      finalizado: item.finalizado ?? false,
      atendimentoTipo: "delivery"
    });
  }

  return rows.sort((a, b) => {
    if (a.atendimentoTipo !== b.atendimentoTipo) {
      return a.atendimentoTipo === "mesa" ? -1 : 1;
    }
    if (a.atendimentoTipo === "mesa" && b.atendimentoTipo === "mesa") {
      return a.mesaNumero - b.mesaNumero;
    }
    return a.pedidoNumero - b.pedidoNumero;
  });
}

export async function markPedidoItemImpresso(itemId: string): Promise<void> {
  const db = await readDb();
  const item = db.pedido_itens.find((row) => row.id === itemId);
  if (item) {
    item.impresso = true;
    item.finalizado = item.finalizado ?? false;
    await writeDb(db);
    return;
  }
  const deliveryItem = db.delivery_itens.find((row) => row.id === itemId);
  if (!deliveryItem) {
    throw new Error("Item não encontrado.");
  }
  deliveryItem.impresso = true;
   deliveryItem.finalizado = deliveryItem.finalizado ?? false;
  await writeDb(db);
}

export async function markPedidoItemFinalizado(itemId: string): Promise<void> {
  const db = await readDb();
  const item = db.pedido_itens.find((row) => row.id === itemId);
  if (item) {
    item.finalizado = true;
    await writeDb(db);
    return;
  }
  const deliveryItem = db.delivery_itens.find((row) => row.id === itemId);
  if (!deliveryItem) {
    throw new Error("Item não encontrado.");
  }
  deliveryItem.finalizado = true;
  await writeDb(db);
}

export async function cancelPedidoItem(itemId: string): Promise<void> {
  const db = await readDb();
  db.pedido_itens = db.pedido_itens.filter((item) => item.id !== itemId);
  await writeDb(db);
}

export async function getMesaContext(mesaId: string): Promise<{
  mesaNumero: number;
  pedidoId: string;
  pedidoNumero: number;
  pedidoAbertoEm: string;
  pessoas: PessoaMesa[];
  categorias: Categoria[];
  produtos: Produto[];
}> {
  const db = await readDb();
  const mesa = db.mesas.find((item) => item.id === mesaId);
  if (!mesa) {
    throw new Error("Mesa não encontrada.");
  }

  const pedido = findOrCreateOpenPedido(db, mesaId);
  mesa.status = "ocupada";
  await writeDb(db);

  return {
    mesaNumero: mesa.numero,
    pedidoId: pedido.id,
    pedidoNumero: pedido.numero,
    pedidoAbertoEm: pedido.aberto_em,
    pessoas: db.pessoas_mesa
      .filter((pessoa) => pessoa.pedido_id === pedido.id && !pessoa.fechado_em)
      .sort((a, b) => a.nome.localeCompare(b.nome)),
    categorias: [...db.categorias].sort((a, b) => a.nome.localeCompare(b.nome)),
    produtos: [...db.produtos].sort((a, b) => a.nome.localeCompare(b.nome))
  };
}

export async function addPessoa(mesaId: string, nome: string): Promise<PessoaMesa> {
  const db = await readDb();
  const mesa = db.mesas.find((item) => item.id === mesaId);
  if (!mesa) {
    throw new Error("Mesa não encontrada.");
  }

  const pedido = findOrCreateOpenPedido(db, mesaId);
  const pessoa: PessoaMesa = {
    id: newId("pes"),
    pedido_id: pedido.id,
    nome,
    fechado_em: null
  };
  db.pessoas_mesa.push(pessoa);
  await writeDb(db);
  return pessoa;
}

export async function addItem(
  mesaId: string,
  pessoaId: string,
  produtoId: string,
  quantidade: number,
  observacao?: string
): Promise<PedidoItem> {
  const db = await readDb();
  const pedido = db.pedidos.find((item) => item.mesa_id === mesaId && item.status === "aberto");
  if (!pedido) {
    throw new Error("Pedido aberto não encontrado para esta mesa.");
  }

  const pessoa = db.pessoas_mesa.find(
    (item) => item.id === pessoaId && item.pedido_id === pedido.id && !item.fechado_em
  );
  if (!pessoa) {
    throw new Error("Pessoa não encontrada nesta mesa.");
  }

  const produto = db.produtos.find((item) => item.id === produtoId);
  if (!produto) {
    throw new Error("Produto não encontrado.");
  }

  const item: PedidoItem = {
    id: newId("item"),
    pessoa_id: pessoaId,
    produto_id: produtoId,
    quantidade: Math.max(1, quantidade || 1),
    observacao: observacao?.trim() || null,
    impresso: false,
    criado_em: new Date().toISOString()
  };
  db.pedido_itens.push(item);
  await writeDb(db);
  return item;
}

export async function getMesaDetalhes(mesaId: string): Promise<{
  pessoas: Array<{
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
  }>;
  totalGeral: number;
}> {
  const db = await readDb();
  const pedido = db.pedidos.find((item) => item.mesa_id === mesaId && item.status === "aberto");
  if (!pedido) {
    return { pessoas: [], totalGeral: 0 };
  }

  const pessoasPedido = db.pessoas_mesa.filter(
    (pessoa) => pessoa.pedido_id === pedido.id && !pessoa.fechado_em
  );
  const detalhesPessoas = pessoasPedido.map((pessoa) => {
    const itensPessoa = db.pedido_itens.filter((item) => item.pessoa_id === pessoa.id);
    const grouped = new Map<
      string,
      { itemId: string; produto: string; quantidade: number; subtotal: number; observacao: string | null }
    >();
    for (const item of itensPessoa) {
      const produto = db.produtos.find((prod) => prod.id === item.produto_id);
      const preco = produto?.preco ?? 0;
      const key = `${item.produto_id}::${item.observacao ?? ""}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.quantidade += item.quantidade;
        existing.subtotal += preco * item.quantidade;
      } else {
        grouped.set(key, {
          itemId: item.id,
          produto: produto?.nome ?? "Produto",
          quantidade: item.quantidade,
          subtotal: preco * item.quantidade,
          observacao: item.observacao
        });
      }
    }
    const itens = Array.from(grouped.values());
    return {
      pessoaId: pessoa.id,
      nome: pessoa.nome,
      itens,
      total: itens.reduce((acc, item) => acc + item.subtotal, 0)
    };
  });

  return {
    pessoas: detalhesPessoas,
    totalGeral: detalhesPessoas.reduce((acc, pessoa) => acc + pessoa.total, 0)
  };
}

export async function getCaixaResumo(dataInicio?: string, dataFim?: string): Promise<{
  resumos: Array<{
    atendimentoTipo: "mesa" | "delivery";
    mesa: { id: string; numero: number; pedidoId: string; pedidoNumero: number } | null;
    delivery: {
      id: string;
      pedidoNumero: number;
      nomeCliente: string;
      telefone: string;
      endereco: string;
      tipoPagamento: TipoPagamento;
    } | null;
    pessoas: Array<{
      id: string;
      nome: string;
      total: number;
      itensPendentes: number;
      itens: Array<{ itemId: string; produto: string; quantidade: number; observacao: string | null }>;
    }>;
    totalGeral: number;
    abertoEm: string;
  }>;
}> {
  const db = await readDb();
  const pedidosAbertos = (db.pedidos ?? []).filter((pedido) => {
    if (pedido.status !== "aberto") return false;
    const dia = (pedido.aberto_em ?? "").slice(0, 10);
    if (dataInicio && dia < dataInicio) return false;
    if (dataFim && dia > dataFim) return false;
    return true;
  });
  const deliveryAbertos = (db.delivery_pedidos ?? []).filter((pedido) => {
    if (pedido.status !== "aberto") return false;
    const dia = (pedido.aberto_em ?? "").slice(0, 10);
    if (dataInicio && dia < dataInicio) return false;
    if (dataFim && dia > dataFim) return false;
    return true;
  });

  const resumos = pedidosAbertos
    .map((pedido) => {
      const mesa = (db.mesas ?? []).find((item) => item.id === pedido.mesa_id);
      if (!mesa) return null;
      const pessoas = (db.pessoas_mesa ?? []).filter(
        (item) => item.pedido_id === pedido.id && !item.fechado_em
      );
      const pessoasResumo = pessoas.map((pessoa) => {
        const itens = (db.pedido_itens ?? []).filter((item) => item.pessoa_id === pessoa.id);
        const grouped = new Map<
          string,
          { itemId: string; produto: string; quantidade: number; observacao: string | null }
        >();
        for (const item of itens) {
          const produto = (db.produtos ?? []).find((prod) => prod.id === item.produto_id);
          const key = `${item.produto_id}::${item.observacao ?? ""}`;
          const existing = grouped.get(key);
          if (existing) {
            existing.quantidade += item.quantidade;
          } else {
            grouped.set(key, {
              itemId: item.id,
              produto: produto?.nome ?? "Produto",
              quantidade: item.quantidade,
              observacao: item.observacao
            });
          }
        }
        const itensDetalhe = Array.from(grouped.values());
        const total = itens.reduce((acc, item) => {
          const produto = (db.produtos ?? []).find((prod) => prod.id === item.produto_id);
          return acc + (produto?.preco ?? 0) * item.quantidade;
        }, 0);
        return {
          id: pessoa.id,
          nome: pessoa.nome,
          total,
          itensPendentes: itens.reduce((acc, item) => acc + item.quantidade, 0),
          itens: itensDetalhe
        };
      });
      return {
        atendimentoTipo: "mesa" as const,
        mesa: { id: mesa.id, numero: mesa.numero, pedidoId: pedido.id, pedidoNumero: pedido.numero },
        delivery: null,
        pessoas: pessoasResumo,
        totalGeral: pessoasResumo.reduce((acc, pessoa) => acc + pessoa.total, 0),
        abertoEm: pedido.aberto_em
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => (a.mesa?.numero ?? 0) - (b.mesa?.numero ?? 0));

  const deliveryResumos = deliveryAbertos
    .map((pedido) => {
      const itens = (db.delivery_itens ?? []).filter((item) => item.delivery_id === pedido.id);
      const grouped = new Map<
        string,
        { itemId: string; produto: string; quantidade: number; observacao: string | null }
      >();
      for (const item of itens) {
        const produto = (db.produtos ?? []).find((prod) => prod.id === item.produto_id);
        const key = `${item.produto_id}::${item.observacao ?? ""}`;
        const existing = grouped.get(key);
        if (existing) {
          existing.quantidade += item.quantidade;
        } else {
          grouped.set(key, {
            itemId: item.id,
            produto: produto?.nome ?? "Produto",
            quantidade: item.quantidade,
            observacao: item.observacao
          });
        }
      }
      const itensDetalhe = Array.from(grouped.values());
      const total = itens.reduce((acc, item) => {
        const produto = (db.produtos ?? []).find((prod) => prod.id === item.produto_id);
        return acc + (produto?.preco ?? 0) * item.quantidade;
      }, 0);
      return {
        atendimentoTipo: "delivery" as const,
        mesa: null,
        delivery: {
          id: pedido.id,
          pedidoNumero: pedido.numero,
          nomeCliente: pedido.nome_cliente,
          telefone: pedido.telefone,
          endereco: pedido.endereco_entrega,
          tipoPagamento: pedido.tipo_pagamento
        },
        pessoas: [
          {
            id: `delivery_${pedido.id}`,
            nome: pedido.nome_cliente,
            total,
            itensPendentes: itens.reduce((acc, item) => acc + item.quantidade, 0),
            itens: itensDetalhe
          }
        ],
        totalGeral: total,
        abertoEm: pedido.aberto_em
      };
    })
    .sort((a, b) => (a.delivery?.pedidoNumero ?? 0) - (b.delivery?.pedidoNumero ?? 0));

  return { resumos: [...resumos, ...deliveryResumos] };
}

export async function createDeliveryPedido(input: {
  nomeCliente: string;
  enderecoEntrega: string;
  telefone: string;
  tipoPagamento: TipoPagamento;
}): Promise<DeliveryPedido> {
  const db = await readDb();
  const pedido: DeliveryPedido = {
    id: newId("del"),
    numero: getNextPedidoNumero(db),
    nome_cliente: input.nomeCliente.trim(),
    endereco_entrega: input.enderecoEntrega.trim(),
    telefone: input.telefone.trim(),
    tipo_pagamento: input.tipoPagamento,
    aberto_em: new Date().toISOString(),
    fechado_em: null,
    status: "aberto"
  };
  db.delivery_pedidos.push(pedido);
  await writeDb(db);
  return pedido;
}

export async function addDeliveryItem(
  deliveryId: string,
  produtoId: string,
  quantidade: number,
  observacao?: string
): Promise<DeliveryItem> {
  const db = await readDb();
  const pedido = db.delivery_pedidos.find((item) => item.id === deliveryId && item.status === "aberto");
  if (!pedido) {
    throw new Error("Pedido de delivery não encontrado.");
  }
  const produto = db.produtos.find((item) => item.id === produtoId);
  if (!produto) {
    throw new Error("Produto não encontrado.");
  }
  const item: DeliveryItem = {
    id: newId("ditem"),
    delivery_id: deliveryId,
    produto_id: produtoId,
    quantidade: Math.max(1, quantidade || 1),
    observacao: observacao?.trim() || null,
    impresso: false,
    criado_em: new Date().toISOString()
  };
  db.delivery_itens.push(item);
  await writeDb(db);
  return item;
}

export async function getDeliveryDetalhes(deliveryId: string): Promise<{
  pedido: DeliveryPedido;
  itens: Array<{
    itemId: string;
    produto: string;
    quantidade: number;
    observacao: string | null;
    subtotal: number;
  }>;
  total: number;
}> {
  const db = await readDb();
  const pedido = db.delivery_pedidos.find((item) => item.id === deliveryId && item.status === "aberto");
  if (!pedido) {
    throw new Error("Pedido de delivery não encontrado.");
  }
  const itens = db.delivery_itens
    .filter((item) => item.delivery_id === deliveryId)
    .map((item) => {
      const produto = db.produtos.find((prod) => prod.id === item.produto_id);
      const subtotal = (produto?.preco ?? 0) * item.quantidade;
      return {
        itemId: item.id,
        produto: produto?.nome ?? "Produto",
        quantidade: item.quantidade,
        observacao: item.observacao,
        subtotal
      };
    });
  const total = itens.reduce((acc, item) => acc + item.subtotal, 0);
  return { pedido, itens, total };
}

export async function closeDeliveryPedido(deliveryId: string): Promise<void> {
  const db = await readDb();
  const pedido = db.delivery_pedidos.find((item) => item.id === deliveryId && item.status === "aberto");
  if (!pedido) {
    throw new Error("Pedido de delivery não encontrado.");
  }
  pedido.status = "fechado";
  pedido.fechado_em = new Date().toISOString();
  await writeDb(db);
}

export async function cancelDeliveryItem(itemId: string): Promise<void> {
  const db = await readDb();
  const before = db.delivery_itens.length;
  db.delivery_itens = db.delivery_itens.filter((item) => item.id !== itemId);
  if (db.delivery_itens.length === before) {
    throw new Error("Item de delivery não encontrado.");
  }
  await writeDb(db);
}

export async function cancelDeliveryPedido(deliveryId: string): Promise<void> {
  const db = await readDb();
  const pedido = db.delivery_pedidos.find((item) => item.id === deliveryId && item.status === "aberto");
  if (!pedido) {
    throw new Error("Pedido de delivery não encontrado ou já encerrado.");
  }
  pedido.status = "cancelado";
  pedido.fechado_em = new Date().toISOString();
  await writeDb(db);
}

export async function listDeliveryAbertos(): Promise<
  Array<{
    id: string;
    numero: number;
    nome_cliente: string;
    telefone: string;
    endereco_entrega: string;
    tipo_pagamento: TipoPagamento;
    aberto_em: string;
  }>
> {
  const db = await readDb();
  return (db.delivery_pedidos ?? [])
    .filter((pedido) => pedido.status === "aberto")
    .sort((a, b) => b.aberto_em.localeCompare(a.aberto_em))
    .map((pedido) => ({
      id: pedido.id,
      numero: pedido.numero,
      nome_cliente: pedido.nome_cliente,
      telefone: pedido.telefone,
      endereco_entrega: pedido.endereco_entrega,
      tipo_pagamento: pedido.tipo_pagamento,
      aberto_em: pedido.aberto_em
    }));
}

export async function getRelatorioPeriodo(
  inicio: string,
  fim: string
): Promise<{
  inicio: string;
  fim: string;
  faturamentoTotal: number;
  itensVendidos: number;
  pedidosPeriodo: number;
  topProdutos: Array<{ nome: string; quantidade: number; valor: number }>;
  vendasPorDia: Array<{ data: string; valor: number }>;
}> {
  const db = await readDb();
  const itensPeriodo = db.pedido_itens.filter((item) =>
    inDateRange(item.criado_em ?? "", inicio, fim)
  );

  const faturamentoTotal = itensPeriodo.reduce((acc, item) => {
    const produto = db.produtos.find((prod) => prod.id === item.produto_id);
    return acc + (produto?.preco ?? 0) * item.quantidade;
  }, 0);
  const itensVendidos = itensPeriodo.reduce((acc, item) => acc + item.quantidade, 0);

  const pedidosPeriodo = new Set(
    db.pedidos
      .filter((pedido) => inDateRange(pedido.aberto_em, inicio, fim))
      .map((pedido) => pedido.id)
  ).size;

  const topMap = new Map<string, { nome: string; quantidade: number; valor: number }>();
  for (const item of itensPeriodo) {
    const produto = db.produtos.find((prod) => prod.id === item.produto_id);
    const key = produto?.id ?? "desconhecido";
    const preco = produto?.preco ?? 0;
    const existing = topMap.get(key);
    if (existing) {
      existing.quantidade += item.quantidade;
      existing.valor += preco * item.quantidade;
    } else {
      topMap.set(key, {
        nome: produto?.nome ?? "Produto",
        quantidade: item.quantidade,
        valor: preco * item.quantidade
      });
    }
  }
  const topProdutos = Array.from(topMap.values())
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 10);

  const diaMap = new Map<string, number>();
  for (const item of itensPeriodo) {
    const dia = (item.criado_em ?? "").slice(0, 10);
    const produto = db.produtos.find((prod) => prod.id === item.produto_id);
    const valor = (produto?.preco ?? 0) * item.quantidade;
    diaMap.set(dia, (diaMap.get(dia) ?? 0) + valor);
  }
  const vendasPorDia = Array.from(diaMap.entries())
    .map(([data, valor]) => ({ data, valor }))
    .sort((a, b) => a.data.localeCompare(b.data));

  return {
    inicio,
    fim,
    faturamentoTotal,
    itensVendidos,
    pedidosPeriodo,
    topProdutos,
    vendasPorDia
  };
}

export async function closePessoa(pessoaId: string): Promise<void> {
  const db = await readDb();
  const pessoa = db.pessoas_mesa.find((item) => item.id === pessoaId);
  if (!pessoa) {
    throw new Error("Pessoa não encontrada.");
  }
  if (!pessoa.fechado_em) {
    pessoa.fechado_em = new Date().toISOString();
  }
  await writeDb(db);
}

export async function closeMesa(mesaId: string, pedidoId?: string): Promise<void> {
  const db = await readDb();
  const pedido = pedidoId
    ? db.pedidos.find((item) => item.id === pedidoId && item.mesa_id === mesaId && item.status === "aberto")
    : db.pedidos.find((item) => item.mesa_id === mesaId && item.status === "aberto");
  if (!pedido) {
    throw new Error("Pedido aberto não encontrado para a mesa.");
  }

  pedido.status = "fechado";
  pedido.fechado_em = new Date().toISOString();
  for (const pessoa of db.pessoas_mesa) {
    if (pessoa.pedido_id === pedido.id && !pessoa.fechado_em) {
      pessoa.fechado_em = pedido.fechado_em;
    }
  }

  const mesa = db.mesas.find((item) => item.id === mesaId);
  const stillOpenForMesa = db.pedidos.some(
    (item) => item.mesa_id === mesaId && item.status === "aberto" && item.id !== pedido.id
  );
  if (mesa && !stillOpenForMesa) {
    mesa.status = "livre";
  }

  await writeDb(db);
}

function inDateRange(dateIso: string | null, dataInicio?: string, dataFim?: string): boolean {
  if (!dateIso) return false;
  const day = dateIso.slice(0, 10);
  if (dataInicio && day < dataInicio) return false;
  if (dataFim && day > dataFim) return false;
  return true;
}

export async function getRelatorioFechamentos(dataInicio?: string, dataFim?: string): Promise<{
  linhas: Array<{
    tipo: "mesa" | "delivery";
    pedidoId: string;
    pedidoNumero: number;
    mesaNumero: number;
    clienteNome?: string;
    abertoEm: string;
    fechadoEm: string;
    pessoas: number;
    itens: number;
    total: number;
    itensDetalhe: Array<{
      itemId: string;
      pessoaNome: string;
      produto: string;
      quantidade: number;
      observacao: string | null;
      subtotal: number;
    }>;
  }>;
  resumo: {
    pedidosFechados: number;
    mesasFechadas: number;
    deliveriesFechados: number;
    faturamento: number;
    ticketMedio: number;
    itensVendidos: number;
  };
}> {
  const db = await readDb();
  const pedidosFechados = db.pedidos.filter(
    (pedido) => pedido.status === "fechado" && inDateRange(pedido.fechado_em, dataInicio, dataFim)
  );

  const linhasMesa = pedidosFechados
    .map((pedido) => {
      const mesa = db.mesas.find((item) => item.id === pedido.mesa_id);
      if (!mesa || !pedido.fechado_em) return null;
      const pessoas = db.pessoas_mesa.filter((pessoa) => pessoa.pedido_id === pedido.id);
      const pessoaById = new Map(pessoas.map((pessoa) => [pessoa.id, pessoa.nome]));
      const pessoaIds = pessoas.map((pessoa) => pessoa.id);
      const itens = db.pedido_itens.filter((item) => pessoaIds.includes(item.pessoa_id));
      const itensDetalhe = itens.map((item) => {
        const produto = db.produtos.find((prod) => prod.id === item.produto_id);
        const preco = produto?.preco ?? 0;
        return {
          itemId: item.id,
          pessoaNome: pessoaById.get(item.pessoa_id) ?? "Pessoa",
          produto: produto?.nome ?? "Produto",
          quantidade: item.quantidade,
          observacao: item.observacao,
          subtotal: preco * item.quantidade
        };
      });
      const total = itensDetalhe.reduce((acc, item) => acc + item.subtotal, 0);
      return {
        tipo: "mesa" as const,
        pedidoId: pedido.id,
        pedidoNumero: pedido.numero,
        mesaNumero: mesa.numero,
        abertoEm: pedido.aberto_em,
        fechadoEm: pedido.fechado_em,
        pessoas: pessoas.length,
        itens: itens.reduce((acc, item) => acc + item.quantidade, 0),
        total,
        itensDetalhe
      };
    })
    .filter((linha): linha is NonNullable<typeof linha> => Boolean(linha));

  const deliveryFechados = (db.delivery_pedidos ?? []).filter(
    (pedido) =>
      pedido.status === "fechado" &&
      pedido.fechado_em &&
      inDateRange(pedido.fechado_em, dataInicio, dataFim)
  );

  const linhasDelivery = deliveryFechados.map((pedido) => {
    const itens = (db.delivery_itens ?? []).filter((item) => item.delivery_id === pedido.id);
    const itensDetalhe = itens.map((item) => {
      const produto = db.produtos.find((prod) => prod.id === item.produto_id);
      const preco = produto?.preco ?? 0;
      return {
        itemId: item.id,
        pessoaNome: pedido.nome_cliente,
        produto: produto?.nome ?? "Produto",
        quantidade: item.quantidade,
        observacao: item.observacao,
        subtotal: preco * item.quantidade
      };
    });
    const total = itensDetalhe.reduce((acc, item) => acc + item.subtotal, 0);
    return {
      tipo: "delivery" as const,
      pedidoId: pedido.id,
      pedidoNumero: pedido.numero,
      mesaNumero: 0,
      clienteNome: pedido.nome_cliente,
      abertoEm: pedido.aberto_em,
      fechadoEm: pedido.fechado_em ?? "",
      pessoas: 1,
      itens: itens.reduce((acc, item) => acc + item.quantidade, 0),
      total,
      itensDetalhe
    };
  });

  const linhas = [...linhasMesa, ...linhasDelivery].sort((a, b) =>
    b.fechadoEm.localeCompare(a.fechadoEm)
  );

  const faturamento = linhas.reduce((acc, linha) => acc + linha.total, 0);
  const itensVendidos = linhas.reduce((acc, linha) => acc + linha.itens, 0);
  const mesasFechadas = new Set(linhasMesa.map((l) => l.mesaNumero)).size;

  return {
    linhas,
    resumo: {
      pedidosFechados: linhas.length,
      mesasFechadas,
      deliveriesFechados: linhasDelivery.length,
      faturamento,
      ticketMedio: linhas.length ? faturamento / linhas.length : 0,
      itensVendidos
    }
  };
}

export async function getDashboardResumo(dataInicio?: string, dataFim?: string): Promise<{
  mesasAbertas: number;
  pedidosAbertos: number;
  pessoasAtivas: number;
  resumoPeriodo: {
    pedidosFechados: number;
    mesasFechadas: number;
    faturamento: number;
    ticketMedio: number;
    itensVendidos: number;
  };
}> {
  const db = await readDb();
  const pedidosAbertosRows = db.pedidos.filter((pedido) => pedido.status === "aberto");
  const mesasAbertas = new Set(pedidosAbertosRows.map((pedido) => pedido.mesa_id)).size;
  const pessoasAtivas = db.pessoas_mesa.filter((pessoa) =>
    !pessoa.fechado_em && pedidosAbertosRows.some((pedido) => pedido.id === pessoa.pedido_id)
  ).length;

  const { resumo } = await getRelatorioFechamentos(dataInicio, dataFim);
  return {
    mesasAbertas,
    pedidosAbertos: pedidosAbertosRows.length,
    pessoasAtivas,
    resumoPeriodo: resumo
  };
}
