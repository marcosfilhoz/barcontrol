import "server-only";

import { supabase } from "@/lib/supabaseClient";

type AtendimentoTipo = "mesa" | "delivery";
type TipoPagamento = "dinheiro" | "pix" | "cartao_credito" | "cartao_debito";

type MesaRow = { id: string; numero: number };
type PedidoRow = {
  id: string;
  mesa_id: string | null;
  numero: number;
  aberto_em: string;
  fechado_em: string | null;
  status: string;
};

type PessoaMesaRow = {
  id: string;
  pedido_id: string;
  nome: string;
  fechado_em: string | null;
};

type PedidoItemRow = {
  id: string;
  pessoa_id: string;
  produto_id: string;
  quantidade: number;
  observacao: string | null;
};

type ProdutoRow = {
  id: string;
  nome: string;
  preco: number;
};

type DeliveryPedidoRow = {
  id: string;
  numero: number;
  nome_cliente: string;
  endereco_entrega: string;
  telefone: string;
  tipo_pagamento: TipoPagamento;
  aberto_em: string;
  fechado_em: string | null;
  status: string;
};

type DeliveryItemRow = {
  id: string;
  delivery_id: string;
  produto_id: string;
  quantidade: number;
  observacao: string | null;
};

function inDateRange(dateIso: string | null, dataInicio?: string, dataFim?: string): boolean {
  if (!dateIso) return false;
  const day = dateIso.slice(0, 10);
  if (dataInicio && day < dataInicio) return false;
  if (dataFim && day > dataFim) return false;
  return true;
}

export async function getCaixaResumo(dataInicio?: string, dataFim?: string): Promise<{
  resumos: Array<{
    atendimentoTipo: AtendimentoTipo;
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
  const { data: pedidosData, error: pedidosError } = await supabase
    .from("pedidos")
    .select("id, mesa_id, numero, aberto_em, fechado_em, status");
  if (pedidosError) throw pedidosError;
  const pedidos = (pedidosData ?? []) as PedidoRow[];

  const pedidosAbertos = pedidos.filter((pedido) => {
    if (pedido.status !== "aberto") return false;
    const dia = (pedido.aberto_em ?? "").slice(0, 10);
    if (dataInicio && dia < dataInicio) return false;
    if (dataFim && dia > dataFim) return false;
    return true;
  });

  const { data: mesasData, error: mesasError } = await supabase
    .from("mesas")
    .select("id, numero");
  if (mesasError) throw mesasError;
  const mesas = (mesasData ?? []) as MesaRow[];

  const { data: pessoasData, error: pessoasError } = await supabase
    .from("pessoas_mesa")
    .select("id, pedido_id, nome, fechado_em");
  if (pessoasError) throw pessoasError;
  const pessoas = (pessoasData ?? []) as PessoaMesaRow[];

  const { data: itensData, error: itensError } = await supabase
    .from("pedido_itens")
    .select("id, pessoa_id, produto_id, quantidade, observacao");
  if (itensError) throw itensError;
  const itens = (itensData ?? []) as PedidoItemRow[];

  const { data: produtosData, error: produtosError } = await supabase
    .from("produtos")
    .select("id, nome, preco");
  if (produtosError) throw produtosError;
  const produtos = (produtosData ?? []) as ProdutoRow[];

  const produtoById = new Map(produtos.map((p) => [p.id, p]));

  const resumosMesa = pedidosAbertos
    .map((pedido) => {
      const mesa = mesas.find((m) => m.id === pedido.mesa_id);
      if (!mesa) return null;
      const pessoasPedido = pessoas.filter(
        (pessoa) => pessoa.pedido_id === pedido.id && !pessoa.fechado_em
      );
      const pessoasResumo = pessoasPedido.map((pessoa) => {
        const itensPessoa = itens.filter((item) => item.pessoa_id === pessoa.id);
        const grouped = new Map<
          string,
          { itemId: string; produto: string; quantidade: number; observacao: string | null }
        >();
        for (const item of itensPessoa) {
          const produto = produtoById.get(item.produto_id);
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
        const total = itensPessoa.reduce((acc, item) => {
          const produto = produtoById.get(item.produto_id);
          return acc + (produto?.preco ?? 0) * item.quantidade;
        }, 0);
        return {
          id: pessoa.id,
          nome: pessoa.nome,
          total,
          itensPendentes: itensPessoa.reduce((acc, item) => acc + item.quantidade, 0),
          itens: itensDetalhe
        };
      });
      return {
        atendimentoTipo: "mesa" as AtendimentoTipo,
        mesa: { id: mesa.id, numero: mesa.numero, pedidoId: pedido.id, pedidoNumero: pedido.numero },
        delivery: null,
        pessoas: pessoasResumo,
        totalGeral: pessoasResumo.reduce((acc, pessoa) => acc + pessoa.total, 0),
        abertoEm: pedido.aberto_em
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => (a.mesa?.numero ?? 0) - (b.mesa?.numero ?? 0));

  const { data: deliveryPedidosData, error: deliveryPedidosError } = await supabase
    .from("delivery_pedidos")
    .select(
      "id, numero, nome_cliente, endereco_entrega, telefone, tipo_pagamento, aberto_em, fechado_em, status"
    );
  if (deliveryPedidosError) throw deliveryPedidosError;
  const deliveryPedidos = (deliveryPedidosData ?? []) as DeliveryPedidoRow[];

  const deliveryAbertos = deliveryPedidos.filter((pedido) => {
    if (pedido.status !== "aberto") return false;
    const dia = (pedido.aberto_em ?? "").slice(0, 10);
    if (dataInicio && dia < dataInicio) return false;
    if (dataFim && dia > dataFim) return false;
    return true;
  });

  const { data: deliveryItensData, error: deliveryItensError } = await supabase
    .from("delivery_itens")
    .select("id, delivery_id, produto_id, quantidade, observacao");
  if (deliveryItensError) throw deliveryItensError;
  const deliveryItens = (deliveryItensData ?? []) as DeliveryItemRow[];

  const deliveryResumos = deliveryAbertos
    .map((pedido) => {
      const itensPedido = deliveryItens.filter((item) => item.delivery_id === pedido.id);
      const grouped = new Map<
        string,
        { itemId: string; produto: string; quantidade: number; observacao: string | null }
      >();
      for (const item of itensPedido) {
        const produto = produtoById.get(item.produto_id);
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
      const total = itensPedido.reduce((acc, item) => {
        const produto = produtoById.get(item.produto_id);
        return acc + (produto?.preco ?? 0) * item.quantidade;
      }, 0);
      return {
        atendimentoTipo: "delivery" as AtendimentoTipo,
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
            itensPendentes: itensPedido.reduce((acc, item) => acc + item.quantidade, 0),
            itens: itensDetalhe
          }
        ],
        totalGeral: total,
        abertoEm: pedido.aberto_em
      };
    })
    .sort((a, b) => (a.delivery?.pedidoNumero ?? 0) - (b.delivery?.pedidoNumero ?? 0));

  return { resumos: [...resumosMesa, ...deliveryResumos] };
}

export async function closePessoa(pessoaId: string): Promise<void> {
  const { data: pessoa, error } = await supabase
    .from("pessoas_mesa")
    .select("id, fechado_em")
    .eq("id", pessoaId)
    .maybeSingle();
  if (error) throw error;
  if (!pessoa) {
    throw new Error("Pessoa não encontrada.");
  }
  if (pessoa.fechado_em) {
    return;
  }
  const { error: updateError } = await supabase
    .from("pessoas_mesa")
    .update({ fechado_em: new Date().toISOString() })
    .eq("id", pessoaId);
  if (updateError) throw updateError;
}

export async function closeMesa(mesaId: string, pedidoId?: string): Promise<void> {
  const { data: pedidosData, error: pedidosError } = await supabase
    .from("pedidos")
    .select("id, mesa_id, status, fechado_em")
    .eq("mesa_id", mesaId);
  if (pedidosError) throw pedidosError;
  const pedidos = (pedidosData ?? []) as PedidoRow[];

  const pedido =
    pedidoId != null
      ? pedidos.find((p) => p.id === pedidoId && p.status === "aberto")
      : pedidos.find((p) => p.status === "aberto");

  if (!pedido) {
    throw new Error("Pedido aberto não encontrado para a mesa.");
  }

  const fechadoEm = new Date().toISOString();

  const { error: updatePedidoError } = await supabase
    .from("pedidos")
    .update({ status: "fechado", fechado_em: fechadoEm })
    .eq("id", pedido.id);
  if (updatePedidoError) throw updatePedidoError;

  const { error: updatePessoasError } = await supabase
    .from("pessoas_mesa")
    .update({ fechado_em: fechadoEm })
    .eq("pedido_id", pedido.id)
    .is("fechado_em", null);
  if (updatePessoasError) throw updatePessoasError;

  const stillOpenForMesa = pedidos.some(
    (p) => p.mesa_id === mesaId && p.status === "aberto" && p.id !== pedido.id
  );
  if (!stillOpenForMesa) {
    const { error: updateMesaError } = await supabase
      .from("mesas")
      .update({ status: "livre" })
      .eq("id", mesaId);
    if (updateMesaError) throw updateMesaError;
  }
}

export async function closeDeliveryPedido(deliveryId: string): Promise<void> {
  const { data: pedido, error } = await supabase
    .from("delivery_pedidos")
    .select("id, status")
    .eq("id", deliveryId)
    .eq("status", "aberto")
    .maybeSingle();
  if (error) throw error;
  if (!pedido) {
    throw new Error("Pedido de delivery não encontrado.");
  }
  const { error: updateError } = await supabase
    .from("delivery_pedidos")
    .update({ status: "fechado", fechado_em: new Date().toISOString() })
    .eq("id", deliveryId);
  if (updateError) throw updateError;
}

export async function getRelatorioFechamentos(dataInicio?: string, dataFim?: string): Promise<{
  linhas: Array<{
    tipo: AtendimentoTipo;
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
  const { data: pedidosData, error: pedidosError } = await supabase
    .from("pedidos")
    .select("id, mesa_id, numero, aberto_em, fechado_em, status");
  if (pedidosError) throw pedidosError;
  const pedidos = (pedidosData ?? []) as PedidoRow[];

  const pedidosFechados = pedidos.filter(
    (pedido) => pedido.status === "fechado" && inDateRange(pedido.fechado_em, dataInicio, dataFim)
  );

  const { data: mesasData, error: mesasError } = await supabase
    .from("mesas")
    .select("id, numero");
  if (mesasError) throw mesasError;
  const mesas = (mesasData ?? []) as MesaRow[];

  const { data: pessoasData, error: pessoasError } = await supabase
    .from("pessoas_mesa")
    .select("id, pedido_id, nome");
  if (pessoasError) throw pessoasError;
  const pessoas = (pessoasData ?? []) as PessoaMesaRow[];

  const pessoaById = new Map(pessoas.map((p) => [p.id, p.nome]));

  const { data: itensData, error: itensError } = await supabase
    .from("pedido_itens")
    .select("id, pessoa_id, produto_id, quantidade, observacao");
  if (itensError) throw itensError;
  const itens = (itensData ?? []) as PedidoItemRow[];

  const { data: produtosData, error: produtosError } = await supabase
    .from("produtos")
    .select("id, nome, preco");
  if (produtosError) throw produtosError;
  const produtos = (produtosData ?? []) as ProdutoRow[];
  const produtoById = new Map(produtos.map((p) => [p.id, p]));

  const linhasMesa = pedidosFechados
    .map((pedido) => {
      const mesa = mesas.find((m) => m.id === pedido.mesa_id);
      if (!mesa || !pedido.fechado_em) return null;
      const pessoasPedido = pessoas.filter((p) => p.pedido_id === pedido.id);
      const pessoaIds = pessoasPedido.map((p) => p.id);
      const itensPedido = itens.filter((item) => pessoaIds.includes(item.pessoa_id));
      const itensDetalhe = itensPedido.map((item) => {
        const produto = produtoById.get(item.produto_id);
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
        tipo: "mesa" as AtendimentoTipo,
        pedidoId: pedido.id,
        pedidoNumero: pedido.numero,
        mesaNumero: mesa.numero,
        abertoEm: pedido.aberto_em,
        fechadoEm: pedido.fechado_em,
        pessoas: pessoasPedido.length,
        itens: itensPedido.reduce((acc, item) => acc + item.quantidade, 0),
        total,
        itensDetalhe
      };
    })
    .filter((linha): linha is NonNullable<typeof linha> => Boolean(linha));

  const { data: deliveryPedidosData, error: deliveryPedidosError } = await supabase
    .from("delivery_pedidos")
    .select(
      "id, numero, nome_cliente, endereco_entrega, telefone, tipo_pagamento, aberto_em, fechado_em, status"
    );
  if (deliveryPedidosError) throw deliveryPedidosError;
  const deliveryPedidos = (deliveryPedidosData ?? []) as DeliveryPedidoRow[];

  const deliveryFechados = deliveryPedidos.filter(
    (pedido) =>
      pedido.status === "fechado" &&
      pedido.fechado_em &&
      inDateRange(pedido.fechado_em, dataInicio, dataFim)
  );

  const { data: deliveryItensData, error: deliveryItensError } = await supabase
    .from("delivery_itens")
    .select("id, delivery_id, produto_id, quantidade, observacao");
  if (deliveryItensError) throw deliveryItensError;
  const deliveryItens = (deliveryItensData ?? []) as DeliveryItemRow[];

  const linhasDelivery = deliveryFechados.map((pedido) => {
    const itensPedido = deliveryItens.filter((item) => item.delivery_id === pedido.id);
    const itensDetalhe = itensPedido.map((item) => {
      const produto = produtoById.get(item.produto_id);
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
      tipo: "delivery" as AtendimentoTipo,
      pedidoId: pedido.id,
      pedidoNumero: pedido.numero,
      mesaNumero: 0,
      clienteNome: pedido.nome_cliente,
      abertoEm: pedido.aberto_em,
      fechadoEm: pedido.fechado_em ?? "",
      pessoas: 1,
      itens: itensPedido.reduce((acc, item) => acc + item.quantidade, 0),
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

