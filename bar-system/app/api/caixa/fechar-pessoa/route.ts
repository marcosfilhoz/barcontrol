import { NextResponse } from "next/server";
import { closePessoa } from "@/lib/localDb";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { pessoaId?: string };
    if (!body.pessoaId) {
      return NextResponse.json({ message: "Pessoa obrigatória." }, { status: 400 });
    }
    await closePessoa(body.pessoaId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao fechar pessoa.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
