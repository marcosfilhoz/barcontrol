import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    if (!params.id) {
      return NextResponse.json({ message: "Pedido obrigatório." }, { status: 400 });
    }
    const { error } = await supabase
      .from("delivery_pedidos")
      .update({ status: "cancelado", fechado_em: new Date().toISOString() })
      .eq("id", params.id);
    if (error) {
      throw error;
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao cancelar pedido de delivery.";
    return NextResponse.json({ message }, { status: 400 });
  }
}

