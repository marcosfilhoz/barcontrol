"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Perfil = "garcom" | "admin" | "caixa";
const SAVED_LOGIN_KEY = "barcontrol_saved_login";
const SAVED_PASSWORD_KEY = "barcontrol_saved_password";

export default function LoginPage() {
  const router = useRouter();

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [rememberCredentials, setRememberCredentials] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedLogin = window.localStorage.getItem(SAVED_LOGIN_KEY) ?? "";
    const savedPassword = window.localStorage.getItem(SAVED_PASSWORD_KEY) ?? "";
    if (savedLogin && savedPassword) {
      setLogin(savedLogin);
      setPassword(savedPassword);
      setRememberCredentials(true);
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const loginValue = login.trim();
    const passwordValue = password.trim();

    if (!loginValue || !passwordValue) {
      setLoading(false);
      setError("Informe login e senha.");
      return;
    }

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: loginValue, senha: passwordValue })
      });
      const payload = (await response.json()) as { perfil?: Perfil; message?: string };
      if (!response.ok || !payload.perfil) {
        throw new Error(payload.message ?? "Falha no login.");
      }
      if (rememberCredentials) {
        window.localStorage.setItem(SAVED_LOGIN_KEY, loginValue);
        window.localStorage.setItem(SAVED_PASSWORD_KEY, passwordValue);
      } else {
        window.localStorage.removeItem(SAVED_LOGIN_KEY);
        window.localStorage.removeItem(SAVED_PASSWORD_KEY);
      }
      router.replace("/");
    } catch (err) {
      setLoading(false);
      const message = err instanceof Error ? err.message : "Erro inesperado no login.";
      setError(message);
    }
  }

  async function sair() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center p-4">
      <section className="w-full rounded-2xl bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold">Login</h1>
        <p className="mt-1 text-sm text-slate-600">
          Entre com login e senha.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm">Login</span>
            <input
              type="text"
              required
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              className="ui-input w-full"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm">Senha</span>
            <input
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="ui-input w-full"
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={rememberCredentials}
              onChange={(event) => setRememberCredentials(event.target.checked)}
            />
            Salvar login e senha neste dispositivo
          </label>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-slate-900 px-4 py-3 font-medium text-white disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <button
          type="button"
          onClick={sair}
          className="mt-3 w-full rounded-lg bg-slate-100 px-4 py-2 text-sm"
        >
          Limpar sessão
        </button>
      </section>
    </main>
  );
}
