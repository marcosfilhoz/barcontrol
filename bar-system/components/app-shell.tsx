"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useState } from "react";

type MenuItem = {
  href: string;
  label: string;
};

type AppShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

const menuItems: MenuItem[] = [
  { href: "/", label: "Home" },
  { href: "/mesas", label: "Mesas" },
  { href: "/delivery", label: "Delivery" },
  { href: "/caixa", label: "Caixa" },
  { href: "/cozinha", label: "Cozinha" },
  { href: "/cardapio", label: "Cardápio" },
  { href: "/categorias", label: "Categorias" },
  { href: "/usuarios", label: "Usuários" }
];

export function AppShell({ title, subtitle, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div className="space-y-4">
      <header className="relative md:hidden">
        <div className="sticky top-0 z-30 -mx-4 flex items-center justify-between bg-white/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Abrir menu"
              onClick={() => setShowMobileMenu((value) => !value)}
              className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-700"
            >
              <span className="text-lg leading-none">=</span>
            </button>
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <span className="h-2 w-2 rounded-full bg-slate-900" />
              BarControl
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
              A
            </span>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="text-sm font-medium text-slate-700"
            >
              Sair
            </button>
          </div>
        </div>

        {showMobileMenu ? (
          <div className="absolute left-0 right-0 top-12 z-40 rounded-xl bg-white p-2 shadow-lg">
            {menuItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setShowMobileMenu(false)}
                  className={`block rounded-md px-3 py-2 text-sm ${active ? "bg-slate-900 text-white" : "text-slate-800 hover:bg-slate-100"}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        ) : null}
      </header>

      <div className="ui-card p-3 md:hidden">
        <p className="text-sm font-semibold">{title}</p>
        {subtitle ? <p className="text-xs text-slate-600">{subtitle}</p> : null}
      </div>

      <div className="hidden gap-6 md:grid md:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="space-y-3">
          <div className="flex items-center gap-2 px-1 py-2 text-base font-semibold text-slate-900">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-900" />
            BarControl
          </div>

          <div className="ui-card p-2">
            {menuItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`mb-1 block rounded-lg px-3 py-2 text-sm ${active ? "bg-slate-950 text-white" : "text-slate-700 hover:bg-slate-100"}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="w-full rounded-lg bg-white px-3 py-2 text-sm shadow-sm"
          >
            Sair
          </button>
        </aside>

        <section className="space-y-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h1 className="text-2xl font-bold">{title}</h1>
            {subtitle ? <p className="text-sm text-slate-600">{subtitle}</p> : null}
          </div>
          {children}
        </section>
      </div>

      <div className="space-y-4 md:hidden">{children}</div>
    </div>
  );
}
