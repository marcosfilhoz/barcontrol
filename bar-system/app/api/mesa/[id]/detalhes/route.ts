import { NextResponse } from "next/server";
import { getMesaDetalhes } from "@/lib/mesasDb";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const data = await getMesaDetalhes(params.id);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar detalhes.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
