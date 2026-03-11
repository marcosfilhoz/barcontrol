import { NextResponse } from "next/server";
import { addPessoa } from "@/lib/mesasDb";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const body = (await request.json()) as { nome?: string };
    const nome = body.nome?.trim() ?? "";
    if (!nome) {
      return NextResponse.json({ message: "Nome obrigatório." }, { status: 400 });
    }

    const pessoa = await addPessoa(params.id, nome);
    return NextResponse.json({ pessoa });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao adicionar pessoa.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
