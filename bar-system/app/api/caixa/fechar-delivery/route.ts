import { NextResponse } from "next/server";
import { closeDeliveryPedido } from "@/lib/localDb";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { deliveryId?: string };
    if (!body.deliveryId) {
      return NextResponse.json({ message: "Delivery obrigatório." }, { status: 400 });
    }
    await closeDeliveryPedido(body.deliveryId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao fechar delivery.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
