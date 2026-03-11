import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { login?: string; senha?: string };
    const login = body.login?.trim() ?? "";
    const senha = body.senha?.trim() ?? "";

    if (!login || !senha) {
      return NextResponse.json({ message: "Informe login e senha." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("operadores")
      .select("perfil")
      .eq("login", login)
      .eq("senha", senha)
      .eq("ativo", true)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return NextResponse.json({ message: "Login ou senha inválidos." }, { status: 401 });
    }

    const response = NextResponse.json({ perfil: data.perfil });
    response.cookies.set("bar_session", "1", {
      path: "/",
      maxAge: 60 * 60 * 8,
      sameSite: "lax"
    });
    response.cookies.set("bar_role", data.perfil, {
      path: "/",
      maxAge: 60 * 60 * 8,
      sameSite: "lax"
    });
    return response;
  } catch {
    return NextResponse.json({ message: "Falha ao processar login." }, { status: 500 });
  }
}
