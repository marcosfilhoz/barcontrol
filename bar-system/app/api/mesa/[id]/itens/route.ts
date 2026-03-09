import { NextResponse } from "next/server";
import { addItem } from "@/lib/localDb";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const body = (await request.json()) as {
      pessoaId?: string;
      produtoId?: string;
      quantidade?: number;
      observacao?: string;
    };

    if (!body.pessoaId || !body.produtoId) {
      return NextResponse.json(
        { message: "Pessoa e produto são obrigatórios." },
        { status: 400 }
      );
    }

    const item = await addItem(
      params.id,
      body.pessoaId,
      body.produtoId,
      body.quantidade ?? 1,
      body.observacao
    );
    return NextResponse.json({ item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao adicionar item.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
