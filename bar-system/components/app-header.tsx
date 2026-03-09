"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type MenuItem = {
  href: string;
  label: string;
};

type AppHeaderProps = {
  title: string;
  subtitle?: string;
  menuItems?: MenuItem[];
};

const defaultMenuItems: MenuItem[] = [
  { href: "/mesas", label: "Ver mesas" },
  { href: "/caixa", label: "Ir para caixa" },
  { href: "/", label: "Início" },
  { href: "/login", label: "Trocar usuário" }
];

export function AppHeader({ title, subtitle, menuItems = defaultMenuItems }: AppHeaderProps) {
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <header className="relative space-y-3">
      <div className="sticky top-0 z-30 -mx-4 flex items-center justify-between border-b bg-white px-4 py-3 md:hidden">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Abrir menu"
            onClick={() => setShowMenu((value) => !value)}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-700"
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
            aria-label="Configurações"
            className="rounded-md p-1.5 text-slate-700"
            onClick={() => router.push("/login")}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 15.5A3.5 3.5 0 1 0 12 8.5A3.5 3.5 0 0 0 12 15.5Z" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.82 2.82l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .95 1.7 1.7 0 0 1-3.2 0 1.7 1.7 0 0 0-1-.95 1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.82-2.82l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.95-1 1.7 1.7 0 0 1 0-3.2 1.7 1.7 0 0 0 .95-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.82-2.82l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.95 1.7 1.7 0 0 1 3.2 0 1.7 1.7 0 0 0 1 .95 1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.82 2.82l-.06.06A1.7 1.7 0 0 0 19.4 9c0 .4.14.78.39 1.08.25.3.58.53.96.65a1.7 1.7 0 0 1 0 3.2 1.7 1.7 0 0 0-.96.65c-.25.3-.39.68-.39 1.08Z" />
            </svg>
          </button>
          <button type="button" onClick={() => void handleSignOut()} className="text-sm font-medium text-slate-700">
            Sair
          </button>
        </div>
      </div>

      <div className="hidden items-start justify-between gap-3 md:flex">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          {subtitle ? <p className="text-sm text-slate-600">{subtitle}</p> : null}
        </div>
        <button
          type="button"
          aria-label="Abrir menu"
          onClick={() => setShowMenu((value) => !value)}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-lg"
        >
          ...
        </button>
      </div>

      <div className="rounded-lg border bg-white p-3 md:hidden">
        <p className="text-sm font-semibold">{title}</p>
        {subtitle ? <p className="text-xs text-slate-600">{subtitle}</p> : null}
      </div>

      {showMenu ? (
        <div className="absolute right-0 top-11 z-20 min-w-44 rounded-lg border bg-white p-1 shadow-md">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm hover:bg-slate-100"
              onClick={() => setShowMenu(false)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </header>
  );
}
