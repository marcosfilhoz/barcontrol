import { NextResponse } from "next/server";
import { addDeliveryItem } from "@/lib/localDb";

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

    const item = await addDeliveryItem(
      params.id,
      body.produtoId,
      body.quantidade ?? 1,
      body.observacao
    );
    return NextResponse.json({ item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao adicionar item no delivery.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
