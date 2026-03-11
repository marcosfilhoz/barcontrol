import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ itemId: string }> }
) {
  try {
    const params = await context.params;
    if (!params.itemId) {
      return NextResponse.json({ message: "Item obrigatório." }, { status: 400 });
    }
    const { error } = await supabase.from("delivery_itens").delete().eq("id", params.itemId);
    if (error) {
      throw error;
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao cancelar item do delivery.";
    return NextResponse.json({ message }, { status: 400 });
  }
}

