import { NextResponse } from "next/server";
import {
  createCategoria,
  deleteCategoria,
  listCategorias,
  updateCategoria
} from "@/lib/localDb";

export async function GET() {
  try {
    const categorias = await listCategorias();
    return NextResponse.json({ categorias });
  } catch {
    return NextResponse.json({ message: "Erro ao carregar categorias." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { nome?: string };
    const nome = body.nome?.trim() ?? "";
    if (!nome) {
      return NextResponse.json({ message: "Nome obrigatório." }, { status: 400 });
    }
    await createCategoria(nome);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao criar categoria.";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { id?: string; nome?: string };
    if (!body.id || !body.nome?.trim()) {
      return NextResponse.json({ message: "Dados inválidos para edição." }, { status: 400 });
    }
    await updateCategoria(body.id, body.nome);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao editar categoria.";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { id?: string };
    if (!body.id) {
      return NextResponse.json({ message: "ID obrigatório." }, { status: 400 });
    }
    await deleteCategoria(body.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao excluir categoria.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
