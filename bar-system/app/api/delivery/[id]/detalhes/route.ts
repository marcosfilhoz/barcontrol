import { NextResponse } from "next/server";
import { getDeliveryDetalhes } from "@/lib/localDb";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const data = await getDeliveryDetalhes(params.id);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar delivery.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
