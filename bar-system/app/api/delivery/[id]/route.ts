import { NextResponse } from "next/server";
import { cancelDeliveryPedido } from "@/lib/localDb";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    if (!params.id) {
      return NextResponse.json({ message: "Pedido obrigatório." }, { status: 400 });
    }
    await cancelDeliveryPedido(params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao cancelar pedido de delivery.";
    return NextResponse.json({ message }, { status: 400 });
  }
}

