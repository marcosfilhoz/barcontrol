import { NextResponse } from "next/server";
import {
  createOperador,
  deleteOperador,
  listOperadores,
  updateOperador
} from "@/lib/localDb";

export async function GET() {
  try {
    const usuarios = await listOperadores();
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

    await createOperador({ nome, login, senha, perfil });
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
    await updateOperador(body.id, {
      nome: body.nome,
      login: body.login,
      perfil: body.perfil,
      senha: body.senha
    });
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
    await deleteOperador(body.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao excluir usuário.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
