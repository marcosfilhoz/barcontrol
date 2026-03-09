import { NextResponse } from "next/server";
import {
  createProduto,
  deleteProduto,
  listCategorias,
  listProdutosWithCategoria,
  updateProduto
} from "@/lib/localDb";

export async function GET() {
  try {
    const [categorias, produtos] = await Promise.all([
      listCategorias(),
      listProdutosWithCategoria()
    ]);
    return NextResponse.json({ categorias, produtos });
  } catch {
    return NextResponse.json(
      { message: "Erro ao carregar dados do cardápio." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      nome?: string;
      preco?: number | string;
      categoriaId?: string;
      setorImpressao?: "cozinha" | "bar";
    };
    const nome = body.nome?.trim() ?? "";
    const preco = Number(body.preco);
    const categoriaId = body.categoriaId?.trim() ?? "";

    if (!nome || !categoriaId || Number.isNaN(preco) || preco <= 0) {
      return NextResponse.json(
        { message: "Informe nome, valor e categoria válidos." },
        { status: 400 }
      );
    }

    await createProduto({
      nome,
      preco,
      categoriaId,
      setorImpressao: body.setorImpressao ?? "cozinha"
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao criar produto.";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: string;
      nome?: string;
      preco?: number | string;
      categoriaId?: string;
      setorImpressao?: "cozinha" | "bar";
    };
    const id = body.id?.trim() ?? "";
    const nome = body.nome?.trim() ?? "";
    const preco = Number(body.preco);
    const categoriaId = body.categoriaId?.trim() ?? "";
    if (!id || !nome || !categoriaId || Number.isNaN(preco) || preco <= 0) {
      return NextResponse.json({ message: "Dados inválidos para edição." }, { status: 400 });
    }
    await updateProduto(id, {
      nome,
      preco,
      categoriaId,
      setorImpressao: body.setorImpressao ?? "cozinha"
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao editar produto.";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { id?: string };
    if (!body.id) {
      return NextResponse.json({ message: "ID obrigatório." }, { status: 400 });
    }
    await deleteProduto(body.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao excluir produto.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
