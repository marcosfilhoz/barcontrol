import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const id = params.id;

    const [{ data: pedido, error: pedError }, { data: itens, error: itensError }] =
      await Promise.all([
        supabase
          .from("delivery_pedidos")
          .select("id, numero, nome_cliente, endereco_entrega, telefone, tipo_pagamento, aberto_em")
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("delivery_itens")
          .select("id, quantidade, observacao, produto_id")
          .eq("delivery_id", id)
      ]);

    if (pedError) throw pedError;
    if (itensError) throw itensError;

    if (!pedido) {
      return NextResponse.json({ message: "Pedido não encontrado." }, { status: 404 });
    }

    const { data: produtos, error: prodError } = await supabase
      .from("produtos")
      .select("id, nome, preco");
    if (prodError) throw prodError;

    const produtosMap = new Map<string, { nome: string; preco: number }>();
    for (const p of produtos ?? []) {
      produtosMap.set(p.id as string, { nome: p.nome as string, preco: Number(p.preco) });
    }

    const itensDetalhe =
      itens?.map((item: any) => {
        const prod = produtosMap.get(item.produto_id) ?? { nome: "Produto", preco: 0 };
        const subtotal = prod.preco * Number(item.quantidade ?? 0);
        return {
          itemId: item.id,
          produto: prod.nome,
          quantidade: item.quantidade,
          observacao: item.observacao,
          subtotal
        };
      }) ?? [];

    const total = itensDetalhe.reduce((acc, item) => acc + item.subtotal, 0);

    return NextResponse.json({
      pedido,
      itens: itensDetalhe,
      total
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar delivery.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
