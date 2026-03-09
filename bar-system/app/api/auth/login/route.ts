import { NextResponse } from "next/server";
import { authOperador } from "@/lib/localDb";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { login?: string; senha?: string };
    const login = body.login?.trim() ?? "";
    const senha = body.senha?.trim() ?? "";

    if (!login || !senha) {
      return NextResponse.json({ message: "Informe login e senha." }, { status: 400 });
    }

    const operador = await authOperador(login, senha);
    if (!operador) {
      return NextResponse.json({ message: "Login ou senha inválidos." }, { status: 401 });
    }

    const response = NextResponse.json({ perfil: operador.perfil });
    response.cookies.set("bar_session", "1", {
      path: "/",
      maxAge: 60 * 60 * 8,
      sameSite: "lax"
    });
    response.cookies.set("bar_role", operador.perfil, {
      path: "/",
      maxAge: 60 * 60 * 8,
      sameSite: "lax"
    });
    return response;
  } catch {
    return NextResponse.json({ message: "Falha ao processar login." }, { status: 500 });
  }
}
