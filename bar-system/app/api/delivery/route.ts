import { NextResponse } from "next/server";
import { createDeliveryPedido, listCategorias, listDeliveryAbertos, listProdutosWithCategoria } from "@/lib/localDb";

export async function GET() {
  try {
    const [categorias, produtos, pedidosAbertos] = await Promise.all([
      listCategorias(),
      listProdutosWithCategoria(),
      listDeliveryAbertos()
    ]);
    return NextResponse.json({ categorias, produtos, pedidosAbertos });
  } catch {
    return NextResponse.json(
      { message: "Erro ao carregar dados para delivery." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      nomeCliente?: string;
      enderecoEntrega?: string;
      telefone?: string;
      tipoPagamento?: "dinheiro" | "pix" | "cartao_credito" | "cartao_debito";
    };
    const nomeCliente = body.nomeCliente?.trim() ?? "";
    const enderecoEntrega = body.enderecoEntrega?.trim() ?? "";
    const telefone = body.telefone?.trim() ?? "";
    const tipoPagamento = body.tipoPagamento;

    if (!nomeCliente || !enderecoEntrega || !telefone || !tipoPagamento) {
      return NextResponse.json(
        { message: "Informe nome, endereço, telefone e tipo de pagamento." },
        { status: 400 }
      );
    }

    const pedido = await createDeliveryPedido({
      nomeCliente,
      enderecoEntrega,
      telefone,
      tipoPagamento
    });
    return NextResponse.json({ pedido });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao criar pedido de delivery.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
