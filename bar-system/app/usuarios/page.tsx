"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { CrudToolbar } from "@/components/crud-toolbar";
import { ModalPanel } from "@/components/modal-panel";

type Perfil = "admin" | "garcom";
type Usuario = {
  id: string;
  nome: string;
  login: string;
  perfil: Perfil;
  ativo: boolean;
};

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [nome, setNome] = useState("");
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [perfil, setPerfil] = useState<Perfil>("garcom");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filtroPerfil, setFiltroPerfil] = useState<"todos" | Perfil>("todos");
  const [openModal, setOpenModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const carregarUsuarios = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/usuarios", { cache: "no-store" });
      const payload = (await response.json()) as { usuarios?: Usuario[]; message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "Erro ao carregar usuários.");
      }
      setUsuarios(payload.usuarios ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar usuários.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregarUsuarios();
  }, [carregarUsuarios]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/usuarios", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId ?? undefined,
          nome,
          login,
          senha: senha || undefined,
          perfil
        })
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "Erro ao cadastrar usuário.");
      }
      setNome("");
      setLogin("");
      setSenha("");
      setPerfil("garcom");
      setSuccess(editingId ? "Usuário atualizado." : "Usuário cadastrado.");
      setOpenModal(false);
      setEditingId(null);
      await carregarUsuarios();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cadastrar usuário.");
    } finally {
      setSaving(false);
    }
  }

  function handleEditar(usuario: Usuario) {
    setEditingId(usuario.id);
    setNome(usuario.nome);
    setLogin(usuario.login);
    setSenha("");
    setPerfil(usuario.perfil);
    setOpenModal(true);
  }

  async function handleExcluir(usuario: Usuario) {
    const ok = window.confirm(`Confirma excluir ${usuario.nome}?`);
    if (!ok) return;
    try {
      const response = await fetch("/api/usuarios", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: usuario.id })
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Erro ao excluir usuário.");
      await carregarUsuarios();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir usuário.");
    }
  }

  const usuariosFiltrados = useMemo(() => {
    const termo = search.trim().toLowerCase();
    return usuarios.filter((usuario) => {
      const atendeBusca = `${usuario.nome} ${usuario.login}`.toLowerCase().includes(termo);
      const atendePerfil = filtroPerfil === "todos" || usuario.perfil === filtroPerfil;
      return atendeBusca && atendePerfil;
    });
  }, [usuarios, search, filtroPerfil]);

  if (loading) {
    return <main className="p-6">Carregando usuários...</main>;
  }

  return (
    <main className="mx-auto max-w-7xl p-4 md:p-6">
      <AppShell title="Usuários" subtitle="Cadastro de novos usuários.">
        <CrudToolbar
          title="Usuários"
          subtitle="Gerenciamento de usuários."
          searchValue={search}
          searchPlaceholder="Buscar usuário..."
          onSearchChange={setSearch}
          createLabel="Novo usuário"
          onCreateClick={() => {
            setEditingId(null);
            setNome("");
            setLogin("");
            setSenha("");
            setPerfil("garcom");
            setOpenModal(true);
          }}
        />
        <section className="mb-3 flex items-center gap-2">
          <select
            value={filtroPerfil}
            onChange={(event) => setFiltroPerfil(event.target.value as "todos" | Perfil)}
            className="ui-input"
          >
            <option value="todos">Todos perfis</option>
            <option value="admin">Admin</option>
            <option value="garcom">Garçom</option>
          </select>
        </section>

        <section className="rounded-2xl bg-white p-3 shadow-sm">
          <div className="grid grid-cols-[1.2fr_1fr_0.8fr_0.8fr] gap-3 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <p>Nome</p>
            <p>Login</p>
            <p>Perfil</p>
            <p>Ações</p>
          </div>
          <div className="space-y-2">
            {usuariosFiltrados.map((usuario) => (
              <div
                key={usuario.id}
                className="grid grid-cols-[1.2fr_1fr_0.8fr_0.8fr] gap-3 rounded-xl bg-slate-50/80 px-4 py-3 text-sm"
              >
                <p className="font-medium">{usuario.nome}</p>
                <p className="text-slate-700">{usuario.login}</p>
                <p>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs">
                    {usuario.perfil}
                  </span>
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleEditar(usuario)}
                    className="rounded-md bg-white px-2 py-1 text-xs"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleExcluir(usuario)}
                    className="rounded-md bg-white px-2 py-1 text-xs text-red-600"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}
            {usuariosFiltrados.length === 0 ? (
              <p className="px-4 py-4 text-sm text-slate-500">Sem usuários.</p>
            ) : null}
          </div>
        </section>

        <ModalPanel
          open={openModal}
          title={editingId ? "Editar usuário" : "Novo usuário"}
          onClose={() => {
            setOpenModal(false);
            setEditingId(null);
          }}
        >
          <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-2">
            <input
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              placeholder="Nome"
              required
              className="ui-input"
            />
            <input
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              placeholder="Login"
              required
              className="ui-input"
            />
            <input
              type="password"
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
              placeholder="Senha"
              required={!editingId}
              className="ui-input"
            />
            <select
              value={perfil}
              onChange={(event) => setPerfil(event.target.value as Perfil)}
              className="ui-input"
            >
              <option value="garcom">Garçom</option>
              <option value="admin">Admin</option>
            </select>
            <button
              type="submit"
              disabled={saving}
              className="md:col-span-2 rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60"
            >
              {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Novo usuário"}
            </button>
          </form>
          {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
          {success ? <p className="mt-2 text-sm text-emerald-700">{success}</p> : null}
        </ModalPanel>
      </AppShell>
    </main>
  );
}
