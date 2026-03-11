import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("operadores")
      .select("id, nome, login, perfil, ativo")
      .order("nome", { ascending: true });
    if (error) {
      throw error;
    }
    const usuarios = (data ?? []).map((op) => ({
      id: op.id,
      nome: op.nome ?? "",
      login: op.login,
      perfil: op.perfil === "admin" ? "admin" : "garcom",
      ativo: op.ativo
    }));
    return NextResponse.json({ usuarios });
  } catch {
    return NextResponse.json({ message: "Erro ao carregar usuários." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      nome?: string;
      login?: string;
      senha?: string;
      perfil?: "admin" | "garcom";
    };
    const nome = body.nome?.trim() ?? "";
    const login = body.login?.trim() ?? "";
    const senha = body.senha?.trim() ?? "";
    const perfil = body.perfil;

    if (!nome || !login || !senha || (perfil !== "admin" && perfil !== "garcom")) {
      return NextResponse.json(
        { message: "Informe nome, login, senha e perfil válidos." },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("operadores").insert({
      nome,
      login,
      senha,
      perfil,
      ativo: true
    });
    if (error) {
      throw error;
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao criar usuário.";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: string;
      nome?: string;
      login?: string;
      senha?: string;
      perfil?: "admin" | "garcom";
    };
    if (
      !body.id ||
      !body.nome ||
      !body.login ||
      (body.perfil !== "admin" && body.perfil !== "garcom")
    ) {
      return NextResponse.json({ message: "Dados inválidos para edição." }, { status: 400 });
    }
    const update: Record<string, unknown> = {
      nome: body.nome,
      login: body.login,
      perfil: body.perfil
    };
    if (body.senha?.trim()) {
      update.senha = body.senha.trim();
    }
    const { error } = await supabase.from("operadores").update(update).eq("id", body.id);
    if (error) {
      throw error;
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao editar usuário.";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { id?: string };
    if (!body.id) {
      return NextResponse.json({ message: "ID obrigatório." }, { status: 400 });
    }
    const { error } = await supabase.from("operadores").delete().eq("id", body.id);
    if (error) {
      throw error;
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao excluir usuário.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
