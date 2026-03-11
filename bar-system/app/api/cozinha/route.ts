import { NextResponse } from "next/server";
import {
  listCozinhaItens,
  markPedidoItemFinalizado,
  markPedidoItemImpresso
} from "@/lib/cozinhaDb";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const filtroParam = url.searchParams.get("filtro");
    const dataParam = url.searchParams.get("data") ?? undefined;
    const filtro =
      filtroParam === "impressos" || filtroParam === "finalizados" || filtroParam === "todos"
        ? filtroParam
        : "pendentes";
    const itens = await listCozinhaItens(filtro, dataParam);
    return NextResponse.json({ itens });
  } catch (err) {
    console.error("[cozinha GET]", err);
    const message = err instanceof Error ? err.message : "Erro ao carregar fila da cozinha.";
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { itemId?: string; acao?: "imprimir" | "finalizar" };
    const { itemId, acao } = body;
    if (!itemId) {
      return NextResponse.json({ message: "Item obrigatório." }, { status: 400 });
    }
    if (acao === "finalizar") {
      await markPedidoItemFinalizado(itemId);
    } else {
      await markPedidoItemImpresso(itemId);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao marcar impressão.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
