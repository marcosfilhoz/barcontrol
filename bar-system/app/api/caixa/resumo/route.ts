import { NextResponse } from "next/server";
import { getCaixaResumo } from "@/lib/localDb";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const dataSingle = url.searchParams.get("data") ?? undefined;
    const dataInicio = url.searchParams.get("dataInicio") ?? dataSingle ?? undefined;
    const dataFim = url.searchParams.get("dataFim") ?? dataSingle ?? undefined;
    const data = await getCaixaResumo(dataInicio ?? undefined, dataFim ?? undefined);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[caixa/resumo]", err);
    const message = err instanceof Error ? err.message : "Erro ao carregar caixa.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
