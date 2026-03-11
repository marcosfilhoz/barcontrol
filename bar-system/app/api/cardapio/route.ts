import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function GET() {
  try {
    const [{ data: categoriasData, error: catError }, { data: produtosData, error: prodError }] =
      await Promise.all([
        supabase.from("categorias").select("id, nome").order("nome", { ascending: true }),
        supabase
          .from("produtos")
          .select("id, nome, preco, setor_impressao, categorias(nome)")
          .order("nome", { ascending: true })
      ]);
    if (catError) throw catError;
    if (prodError) throw prodError;

    const categorias = categoriasData ?? [];
    const produtos =
      produtosData?.map((p: any) => ({
        id: p.id,
        nome: p.nome,
        preco: Number(p.preco),
        categoria: p.categorias?.nome ?? "Sem categoria",
        setor_impressao: p.setor_impressao
      })) ?? [];
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

    const { error } = await supabase.from("produtos").insert({
      nome,
      preco,
      categoria_id: categoriaId,
      setor_impressao: body.setorImpressao ?? "cozinha"
    });
    if (error) {
      throw error;
    }
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
    const { error } = await supabase
      .from("produtos")
      .update({
        nome,
        preco,
        categoria_id: categoriaId,
        setor_impressao: body.setorImpressao ?? "cozinha"
      })
      .eq("id", id);
    if (error) {
      throw error;
    }
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
    // Impede exclusão se já houver itens de pedido usando o produto
    const { data: itens, error: itensError } = await supabase
      .from("pedido_itens")
      .select("id")
      .eq("produto_id", body.id)
      .limit(1);
    if (itensError) throw itensError;
    if (itens && itens.length > 0) {
      return NextResponse.json(
        { message: "Não é possível excluir produto já usado em pedidos." },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("produtos").delete().eq("id", body.id);
    if (error) {
      throw error;
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao excluir produto.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
