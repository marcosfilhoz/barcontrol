import { NextResponse } from "next/server";
import { getRelatorioFechamentos } from "@/lib/localDb";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const dataInicio = url.searchParams.get("dataInicio") ?? undefined;
    const dataFim = url.searchParams.get("dataFim") ?? undefined;
    const data = await getRelatorioFechamentos(dataInicio, dataFim);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { message: "Erro ao carregar relatório de fechamentos." },
      { status: 500 }
    );
  }
}
