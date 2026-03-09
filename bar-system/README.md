# Bar System

Base inicial para sistema de bar/restaurante com:

- Frontend/API: Next.js (App Router)
- Banco local (desenvolvimento): arquivo JSON em `data/local-db.json`
- Banco/Auth (producao): Supabase
- Deploy: Vercel
- Impressao: agente local (`print-agent`)

## Setup rapido

1. Instale dependencias:

```bash
npm install
```

2. Crie `.env.local` usando `env.example`:

```bash
cp env.example .env.local
```

3. Suba o app:

```bash
npm run dev
```

No primeiro acesso, use:

- login: `admin`
- senha: `admin`

O banco local e criado automaticamente no primeiro uso em `data/local-db.json`.

## Rotas atuais

- `/login`: autenticacao via login/senha
- `/mesas`: listagem de mesas
- `/mesa/[id]`: abrir/continuar pedido e adicionar pessoas/itens
- `/caixa`: totais por pessoa e fechamento de pessoa/mesa
- `/cozinha`: fila de itens de comida pendentes para impressao (80mm)
- `/cardapio`: cadastro de produtos (nome, valor, categoria)
- `/categorias`: cadastro de categorias
- `/usuarios`: cadastro e listagem de usuarios (Admin / Garcom)
- `/acesso-negado`: fallback para perfil sem permissao

## Perfis e protecao de rotas (modo local)

O middleware protege:

- `/mesas` e `/mesa/*`: `garcom` ou `caixa`
- `/caixa`: apenas `caixa`

Login padrao inicial:

- login: `admin`
- senha: `admin`
- perfil: `caixa`

Para criar outros operadores, edite `data/local-db.json` e adicione em `operadores`:

```json
{
  "id": "op_garcom_1",
  "nome": "Nome Operador",
  "login": "garcom1",
  "senha": "123456",
  "perfil": "garcom",
  "ativo": true
}
```

## Migracao para Supabase depois

- O schema sugerido esta em `sql/schema.sql`
- Basta trocar as rotas API locais para chamadas Supabase server-side

## Proximas etapas

- Fluxo de impressao de pre-conta
- Melhorias de UX mobile-first
