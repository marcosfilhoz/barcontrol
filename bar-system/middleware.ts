import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ALLOWED_FOR_MESAS = new Set(["garcom", "admin", "caixa"]);
const ALLOWED_FOR_CAIXA = new Set(["admin", "caixa"]);
const ALLOWED_FOR_CARDAPIO = new Set(["admin", "caixa"]);
const ALLOWED_FOR_USUARIOS = new Set(["admin", "caixa"]);
const ALLOWED_FOR_COZINHA = new Set(["admin", "caixa"]);
const ALLOWED_FOR_CATEGORIAS = new Set(["admin", "caixa"]);
const ALLOWED_FOR_DELIVERY = new Set(["garcom", "admin", "caixa"]);

function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get("bar_session")?.value;
  const role = request.cookies.get("bar_role")?.value;

  if (!sessionCookie) {
    return redirectToLogin(request);
  }

  if (pathname.startsWith("/caixa") && !ALLOWED_FOR_CAIXA.has(role ?? "")) {
    return NextResponse.redirect(new URL("/acesso-negado", request.url));
  }

  if (pathname.startsWith("/cardapio") && !ALLOWED_FOR_CARDAPIO.has(role ?? "")) {
    return NextResponse.redirect(new URL("/acesso-negado", request.url));
  }

  if (pathname.startsWith("/usuarios") && !ALLOWED_FOR_USUARIOS.has(role ?? "")) {
    return NextResponse.redirect(new URL("/acesso-negado", request.url));
  }

  if (pathname.startsWith("/cozinha") && !ALLOWED_FOR_COZINHA.has(role ?? "")) {
    return NextResponse.redirect(new URL("/acesso-negado", request.url));
  }

  if (pathname.startsWith("/categorias") && !ALLOWED_FOR_CATEGORIAS.has(role ?? "")) {
    return NextResponse.redirect(new URL("/acesso-negado", request.url));
  }

  if (pathname.startsWith("/delivery") && !ALLOWED_FOR_DELIVERY.has(role ?? "")) {
    return NextResponse.redirect(new URL("/acesso-negado", request.url));
  }

  if (
    (pathname.startsWith("/mesas") || pathname.startsWith("/mesa/")) &&
    !ALLOWED_FOR_MESAS.has(role ?? "")
  ) {
    return NextResponse.redirect(new URL("/acesso-negado", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/mesas/:path*",
    "/mesa/:path*",
    "/caixa/:path*",
    "/cozinha/:path*",
    "/delivery/:path*",
    "/cardapio/:path*",
    "/categorias/:path*",
    "/usuarios/:path*"
  ]
};
