import { NextResponse } from "next/server";
import { closeMesa } from "@/lib/localDb";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { mesaId?: string; pedidoId?: string };
    if (!body.mesaId) {
      return NextResponse.json({ message: "Mesa obrigatória." }, { status: 400 });
    }
    await closeMesa(body.mesaId, body.pedidoId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao fechar mesa.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
