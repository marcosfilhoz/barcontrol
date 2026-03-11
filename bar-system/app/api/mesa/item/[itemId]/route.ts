import { NextResponse } from "next/server";
import { cancelPedidoItem } from "@/lib/mesasDb";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ itemId: string }> }
) {
  try {
    const params = await context.params;
    await cancelPedidoItem(params.itemId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao cancelar item.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
