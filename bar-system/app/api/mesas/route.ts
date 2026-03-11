import { NextResponse } from "next/server";
import { listMesas } from "@/lib/mesasDb";

export async function GET() {
  try {
    const mesas = await listMesas();
    return NextResponse.json({ mesas });
  } catch {
    return NextResponse.json({ message: "Erro ao carregar mesas." }, { status: 500 });
  }
}
