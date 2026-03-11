import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function GET() {
  try {
    const [
      { data: categoriasData, error: catError },
      { data: produtosData, error: prodError },
      { data: pedidosData, error: pedError }
    ] = await Promise.all([
      supabase.from("categorias").select("id, nome").order("nome", { ascending: true }),
      supabase
        .from("produtos")
        .select("id, nome, preco, setor_impressao, categorias(nome)")
        .order("nome", { ascending: true }),
      supabase
        .from("delivery_pedidos")
        .select("id, numero, nome_cliente, endereco_entrega, telefone, tipo_pagamento, aberto_em, status")
        .eq("status", "aberto")
        .order("aberto_em", { ascending: false })
    ]);

    if (catError) throw catError;
    if (prodError) throw prodError;
    if (pedError) throw pedError;

    const categorias = categoriasData ?? [];
    const produtos =
      produtosData?.map((p: any) => ({
        id: p.id,
        nome: p.nome,
        preco: Number(p.preco),
        categoria: p.categorias?.nome ?? "Sem categoria",
        setor_impressao: p.setor_impressao
      })) ?? [];
    const pedidosAbertos =
      pedidosData?.map((p: any) => ({
        id: p.id,
        numero: p.numero,
        nome_cliente: p.nome_cliente,
        endereco_entrega: p.endereco_entrega,
        telefone: p.telefone,
        tipo_pagamento: p.tipo_pagamento,
        aberto_em: p.aberto_em
      })) ?? [];

    return NextResponse.json({ categorias, produtos, pedidosAbertos });
  } catch {
    return NextResponse.json(
      { message: "Erro ao carregar dados para delivery." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      nomeCliente?: string;
      enderecoEntrega?: string;
      telefone?: string;
      tipoPagamento?: "dinheiro" | "pix" | "cartao_credito" | "cartao_debito";
    };
    const nomeCliente = body.nomeCliente?.trim() ?? "";
    const enderecoEntrega = body.enderecoEntrega?.trim() ?? "";
    const telefone = body.telefone?.trim() ?? "";
    const tipoPagamento = body.tipoPagamento;

    if (!nomeCliente || !enderecoEntrega || !telefone || !tipoPagamento) {
      return NextResponse.json(
        { message: "Informe nome, endereço, telefone e tipo de pagamento." },
        { status: 400 }
      );
    }

    // Calcula próximo número de pedido de delivery
    const { data: ultimo, error: maxError } = await supabase
      .from("delivery_pedidos")
      .select("numero")
      .order("numero", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (maxError) {
      throw maxError;
    }
    const proximoNumero = (ultimo?.numero ?? 0) + 1;

    const { data, error } = await supabase
      .from("delivery_pedidos")
      .insert({
        numero: proximoNumero,
        nome_cliente: nomeCliente,
        endereco_entrega: enderecoEntrega,
        telefone,
        tipo_pagamento: tipoPagamento,
        status: "aberto"
      })
      .select("id, numero, nome_cliente, endereco_entrega, telefone, tipo_pagamento, aberto_em")
      .maybeSingle();

    if (error) {
      throw error;
    }

    const pedido = data ?? null;
    return NextResponse.json({ pedido });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao criar pedido de delivery.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
