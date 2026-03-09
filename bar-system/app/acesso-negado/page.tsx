import Link from "next/link";
import { AppShell } from "@/components/app-shell";

export default function AcessoNegadoPage() {
  return (
    <main className="mx-auto min-h-screen max-w-7xl p-4 md:p-6">
      <AppShell title="Acesso negado" subtitle="Seu perfil não tem permissão para acessar esta área.">
        <section className="ui-card w-full p-5 text-center">
          <h1 className="text-2xl font-bold">Acesso negado</h1>
          <p className="mt-2 text-sm text-slate-600">
            Seu perfil não tem permissão para acessar esta área.
          </p>

          <div className="mt-5 flex flex-col gap-2">
            <Link
              href="/login"
              className="rounded-lg bg-slate-900 px-4 py-3 text-white"
            >
              Voltar para login
            </Link>
            <Link
              href="/"
              className="rounded-lg bg-slate-100 px-4 py-3 text-slate-900"
            >
              Ir para início
            </Link>
          </div>
        </section>
      </AppShell>
    </main>
  );
}
