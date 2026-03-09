import { NextResponse } from "next/server";
import { cancelDeliveryItem } from "@/lib/localDb";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ itemId: string }> }
) {
  try {
    const params = await context.params;
    if (!params.itemId) {
      return NextResponse.json({ message: "Item obrigatório." }, { status: 400 });
    }
    await cancelDeliveryItem(params.itemId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao cancelar item do delivery.";
    return NextResponse.json({ message }, { status: 400 });
  }
}

