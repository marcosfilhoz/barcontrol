import "server-only";

import { supabase } from "@/lib/supabaseClient";

type MesaStatus = "livre" | "ocupada" | "fechando";

export type Mesa = { id: string; numero: number; status: MesaStatus };

export type PessoaMesa = { id: string; pedido_id: string; nome: string; fechado_em: string | null };

export type Categoria = { id: string; nome: string };

export type Produto = {
  id: string;
  nome: string;
  preco: number;
  categoria_id: string;
  setor_impressao: string | null;
};

export type Pedido = {
  id: string;
  numero: number;
  mesa_id: string;
  aberto_em: string;
  fechado_em: string | null;
  status: "aberto" | "fechado";
};

export type PedidoItem = {
  id: string;
  pessoa_id: string;
  produto_id: string;
  quantidade: number;
  observacao: string | null;
  impresso: boolean;
  criado_em: string;
  finalizado: boolean;
};

async function getOrCreateOpenPedido(mesaId: string): Promise<Pedido> {
  const { data: existing, error: selectError } = await supabase
    .from("pedidos")
    .select("id, numero, mesa_id, aberto_em, fechado_em, status")
    .eq("mesa_id", mesaId)
    .eq("status", "aberto")
    .order("aberto_em", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  if (existing) {
    return existing as Pedido;
  }

  const { data: maxNumeroData, error: numeroError } = await supabase
    .from("pedidos")
    .select("numero")
    .order("numero", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (numeroError) {
    throw numeroError;
  }

  const nextNumero = (maxNumeroData?.numero ?? 0) + 1;

  const { data: inserted, error: insertError } = await supabase
    .from("pedidos")
    .insert({
      mesa_id: mesaId,
      numero: nextNumero,
      status: "aberto"
    })
    .select("id, numero, mesa_id, aberto_em, fechado_em, status")
    .single();

  if (insertError) {
    throw insertError;
  }

  return inserted as Pedido;
}

export async function listMesas(): Promise<Mesa[]> {
  const { data, error } = await supabase
    .from("mesas")
    .select("id, numero, status")
    .order("numero", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as Mesa[];
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
  const { data: mesa, error: mesaError } = await supabase
    .from("mesas")
    .select("id, numero, status")
    .eq("id", mesaId)
    .maybeSingle();

  if (mesaError) {
    throw mesaError;
  }
  if (!mesa) {
    throw new Error("Mesa não encontrada.");
  }

  const pedido = await getOrCreateOpenPedido(mesaId);

  const { error: updateMesaError } = await supabase
    .from("mesas")
    .update({ status: "ocupada" })
    .eq("id", mesaId);

  if (updateMesaError) {
    throw updateMesaError;
  }

  const { data: pessoas, error: pessoasError } = await supabase
    .from("pessoas_mesa")
    .select("id, pedido_id, nome, fechado_em")
    .eq("pedido_id", pedido.id)
    .is("fechado_em", null)
    .order("nome", { ascending: true });

  if (pessoasError) {
    throw pessoasError;
  }

  const { data: categorias, error: categoriasError } = await supabase
    .from("categorias")
    .select("id, nome")
    .order("nome", { ascending: true });

  if (categoriasError) {
    throw categoriasError;
  }

  const { data: produtos, error: produtosError } = await supabase
    .from("produtos")
    .select("id, nome, preco, categoria_id, setor_impressao")
    .order("nome", { ascending: true });

  if (produtosError) {
    throw produtosError;
  }

  return {
    mesaNumero: mesa.numero as number,
    pedidoId: pedido.id,
    pedidoNumero: pedido.numero,
    pedidoAbertoEm: pedido.aberto_em,
    pessoas: (pessoas ?? []) as PessoaMesa[],
    categorias: (categorias ?? []) as Categoria[],
    produtos: (produtos ?? []) as Produto[]
  };
}

export async function addPessoa(mesaId: string, nome: string): Promise<PessoaMesa> {
  const { data: mesa, error: mesaError } = await supabase
    .from("mesas")
    .select("id")
    .eq("id", mesaId)
    .maybeSingle();

  if (mesaError) {
    throw mesaError;
  }
  if (!mesa) {
    throw new Error("Mesa não encontrada.");
  }

  const pedido = await getOrCreateOpenPedido(mesaId);

  const { data, error } = await supabase
    .from("pessoas_mesa")
    .insert({
      pedido_id: pedido.id,
      nome: nome.trim()
    })
    .select("id, pedido_id, nome, fechado_em")
    .single();

  if (error) {
    throw error;
  }

  return data as PessoaMesa;
}

export async function addItem(
  mesaId: string,
  pessoaId: string,
  produtoId: string,
  quantidade: number,
  observacao?: string
): Promise<PedidoItem> {
  const pedido = await getOrCreateOpenPedido(mesaId);

  const { data: pessoa, error: pessoaError } = await supabase
    .from("pessoas_mesa")
    .select("id, pedido_id, fechado_em")
    .eq("id", pessoaId)
    .eq("pedido_id", pedido.id)
    .maybeSingle();

  if (pessoaError) {
    throw pessoaError;
  }
  if (!pessoa || pessoa.fechado_em) {
    throw new Error("Pessoa não encontrada nesta mesa.");
  }

  const { data: produto, error: produtoError } = await supabase
    .from("produtos")
    .select("id")
    .eq("id", produtoId)
    .maybeSingle();

  if (produtoError) {
    throw produtoError;
  }
  if (!produto) {
    throw new Error("Produto não encontrado.");
  }

  const { data, error } = await supabase
    .from("pedido_itens")
    .insert({
      pessoa_id: pessoaId,
      produto_id: produtoId,
      quantidade: Math.max(1, quantidade || 1),
      observacao: observacao?.trim() || null,
      impresso: false
    })
    .select("id, pessoa_id, produto_id, quantidade, observacao, impresso, criado_em, finalizado")
    .single();

  if (error) {
    throw error;
  }

  return {
    ...data,
    criado_em: data.criado_em ?? new Date().toISOString(),
    finalizado: data.finalizado ?? false
  } as PedidoItem;
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
  const { data: pedido, error: pedidoError } = await supabase
    .from("pedidos")
    .select("id")
    .eq("mesa_id", mesaId)
    .eq("status", "aberto")
    .maybeSingle();

  if (pedidoError) {
    throw pedidoError;
  }
  if (!pedido) {
    return { pessoas: [], totalGeral: 0 };
  }

  const { data: pessoas, error: pessoasError } = await supabase
    .from("pessoas_mesa")
    .select("id, nome, fechado_em")
    .eq("pedido_id", pedido.id)
    .is("fechado_em", null);

  if (pessoasError) {
    throw pessoasError;
  }

  const pessoaRows = (pessoas ?? []) as Array<{ id: string; nome: string }>;
  if (pessoaRows.length === 0) {
    return { pessoas: [], totalGeral: 0 };
  }

  const pessoaIds = pessoaRows.map((p) => p.id);

  const { data: itens, error: itensError } = await supabase
    .from("pedido_itens")
    .select("id, pessoa_id, produto_id, quantidade, observacao")
    .in("pessoa_id", pessoaIds);

  if (itensError) {
    throw itensError;
  }

  const { data: produtos, error: produtosError } = await supabase
    .from("produtos")
    .select("id, nome, preco");

  if (produtosError) {
    throw produtosError;
  }

  const produtoById = new Map(
    (produtos ?? []).map((p) => [p.id as string, { nome: p.nome as string, preco: Number(p.preco) }])
  );

  const itensRows =
    (itens ?? []) as Array<{
      id: string;
      pessoa_id: string;
      produto_id: string;
      quantidade: number;
      observacao: string | null;
    }>;

  const detalhesPessoas = pessoaRows.map((pessoa) => {
    const itensPessoa = itensRows.filter((item) => item.pessoa_id === pessoa.id);
    const grouped = new Map<
      string,
      { itemId: string; produto: string; quantidade: number; subtotal: number; observacao: string | null }
    >();

    for (const item of itensPessoa) {
      const produto = produtoById.get(item.produto_id);
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

    const itensArray = Array.from(grouped.values());
    return {
      pessoaId: pessoa.id,
      nome: pessoa.nome,
      itens: itensArray,
      total: itensArray.reduce((acc, item) => acc + item.subtotal, 0)
    };
  });

  return {
    pessoas: detalhesPessoas,
    totalGeral: detalhesPessoas.reduce((acc, pessoa) => acc + pessoa.total, 0)
  };
}

export async function cancelPedidoItem(itemId: string): Promise<void> {
  const { error } = await supabase.from("pedido_itens").delete().eq("id", itemId);
  if (error) {
    throw error;
  }
}

