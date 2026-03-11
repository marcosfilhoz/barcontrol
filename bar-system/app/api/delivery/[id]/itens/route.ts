import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const body = (await request.json()) as {
      produtoId?: string;
      quantidade?: number;
      observacao?: string;
    };

    if (!body.produtoId) {
      return NextResponse.json({ message: "Produto obrigatório." }, { status: 400 });
    }

    const quantidade = body.quantidade && body.quantidade > 0 ? body.quantidade : 1;
    const { error } = await supabase.from("delivery_itens").insert({
      delivery_id: params.id,
      produto_id: body.produtoId,
      quantidade,
      observacao: body.observacao ?? null
    });
    if (error) {
      throw error;
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao adicionar item no delivery.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
