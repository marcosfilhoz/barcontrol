import "server-only";

import { supabase } from "@/lib/supabaseClient";

type AtendimentoTipo = "mesa" | "delivery";

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
    atendimentoTipo: AtendimentoTipo;
  }>
> {
  const diaFiltro = data ?? null;

  const { data: itensMesa, error: itensMesaError } = await supabase
    .from("pedido_itens_view_cozinha")
    .select(
      [
        "id",
        "mesa_numero",
        "pessoa_nome",
        "categoria_nome",
        "produto_nome",
        "quantidade",
        "observacao",
        "pedido_numero",
        "impresso",
        "finalizado",
        "criado_em"
      ].join(", ")
    );

  if (itensMesaError) {
    throw itensMesaError;
  }

  const { data: itensDelivery, error: itensDeliveryError } = await supabase
    .from("delivery_itens_view_cozinha")
    .select(
      [
        "id",
        "cliente_nome",
        "categoria_nome",
        "produto_nome",
        "quantidade",
        "observacao",
        "pedido_numero",
        "impresso",
        "finalizado",
        "criado_em"
      ].join(", ")
    );

  if (itensDeliveryError) {
    throw itensDeliveryError;
  }

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
    atendimentoTipo: AtendimentoTipo;
    criadoEm: string;
  }> = [];

  for (const item of itensMesa ?? []) {
    const criadoEm = (item as any).criado_em as string | null;
    if (diaFiltro && (!criadoEm || criadoEm.slice(0, 10) !== diaFiltro)) continue;

    const impresso = Boolean((item as any).impresso);
    const finalizado = Boolean((item as any).finalizado);

    if (filtro === "pendentes" && (impresso || finalizado)) continue;
    if (filtro === "impressos" && (!impresso || finalizado)) continue;
    if (filtro === "finalizados" && !finalizado) continue;

    rows.push({
      itemId: (item as any).id as string,
      mesaNumero: Number((item as any).mesa_numero ?? 0),
      pessoaNome: (item as any).pessoa_nome as string,
      categoriaNome: (item as any).categoria_nome as string,
      produtoNome: (item as any).produto_nome as string,
      quantidade: Number((item as any).quantidade ?? 0),
      observacao: ((item as any).observacao as string | null) ?? null,
      pedidoNumero: Number((item as any).pedido_numero ?? 0),
      impresso,
      finalizado,
      atendimentoTipo: "mesa",
      criadoEm: criadoEm ?? ""
    });
  }

  for (const item of itensDelivery ?? []) {
    const criadoEm = (item as any).criado_em as string | null;
    if (diaFiltro && (!criadoEm || criadoEm.slice(0, 10) !== diaFiltro)) continue;

    const impresso = Boolean((item as any).impresso);
    const finalizado = Boolean((item as any).finalizado);

    if (filtro === "pendentes" && (impresso || finalizado)) continue;
    if (filtro === "impressos" && (!impresso || finalizado)) continue;
    if (filtro === "finalizados" && !finalizado) continue;

    rows.push({
      itemId: (item as any).id as string,
      mesaNumero: 0,
      pessoaNome: (item as any).cliente_nome as string,
      categoriaNome: (item as any).categoria_nome as string,
      produtoNome: (item as any).produto_nome as string,
      quantidade: Number((item as any).quantidade ?? 0),
      observacao: ((item as any).observacao as string | null) ?? null,
      pedidoNumero: Number((item as any).pedido_numero ?? 0),
      impresso,
      finalizado,
      atendimentoTipo: "delivery",
      criadoEm: criadoEm ?? ""
    });
  }

  return rows.sort((a, b) => {
    if (a.atendimentoTipo !== b.atendimentoTipo) {
      return a.atendimentoTipo === "mesa" ? -1 : 1;
    }
    if (a.atendimentoTipo === "mesa" && b.atendimentoTipo === "mesa") {
      if (a.mesaNumero !== b.mesaNumero) {
        return a.mesaNumero - b.mesaNumero;
      }
    }
    return a.pedidoNumero - b.pedidoNumero;
  });
}

export async function markPedidoItemImpresso(itemId: string): Promise<void> {
  const { data: pedidoItem, error: pedidoItemError } = await supabase
    .from("pedido_itens")
    .select("id")
    .eq("id", itemId)
    .maybeSingle();

  if (pedidoItemError) {
    throw pedidoItemError;
  }

  if (pedidoItem) {
    const { error } = await supabase
      .from("pedido_itens")
      .update({ impresso: true })
      .eq("id", itemId);
    if (error) {
      throw error;
    }
    return;
  }

  const { data: deliveryItem, error: deliveryItemError } = await supabase
    .from("delivery_itens")
    .select("id")
    .eq("id", itemId)
    .maybeSingle();

  if (deliveryItemError) {
    throw deliveryItemError;
  }

  if (!deliveryItem) {
    throw new Error("Item não encontrado.");
  }

  const { error } = await supabase
    .from("delivery_itens")
    .update({ impresso: true })
    .eq("id", itemId);
  if (error) {
    throw error;
  }
}

export async function markPedidoItemFinalizado(itemId: string): Promise<void> {
  const { data: pedidoItem, error: pedidoItemError } = await supabase
    .from("pedido_itens")
    .select("id")
    .eq("id", itemId)
    .maybeSingle();

  if (pedidoItemError) {
    throw pedidoItemError;
  }

  if (pedidoItem) {
    const { error } = await supabase
      .from("pedido_itens")
      .update({ finalizado: true })
      .eq("id", itemId);
    if (error) {
      throw error;
    }
    return;
  }

  const { data: deliveryItem, error: deliveryItemError } = await supabase
    .from("delivery_itens")
    .select("id")
    .eq("id", itemId)
    .maybeSingle();

  if (deliveryItemError) {
    throw deliveryItemError;
  }

  if (!deliveryItem) {
    throw new Error("Item não encontrado.");
  }

  const { error } = await supabase
    .from("delivery_itens")
    .update({ finalizado: true })
    .eq("id", itemId);
  if (error) {
    throw error;
  }
}

