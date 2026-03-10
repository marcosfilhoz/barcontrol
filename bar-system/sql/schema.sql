create extension if not exists "uuid-ossp";

create table if not exists mesas (
  id uuid primary key default uuid_generate_v4(),
  numero integer not null,
  status text default 'livre'
);

create table if not exists pedidos (
  id uuid primary key default uuid_generate_v4(),
  mesa_id uuid references mesas(id),
  aberto_em timestamp default now(),
  fechado_em timestamp,
  status text default 'aberto'
);

create table if not exists pessoas_mesa (
  id uuid primary key default uuid_generate_v4(),
  pedido_id uuid references pedidos(id),
  nome text not null
);

create table if not exists categorias (
  id uuid primary key default uuid_generate_v4(),
  nome text not null
);

create table if not exists produtos (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  preco numeric not null,
  categoria_id uuid references categorias(id),
  setor_impressao text
);

create table if not exists pedido_itens (
  id uuid primary key default uuid_generate_v4(),
  pessoa_id uuid references pessoas_mesa(id),
  produto_id uuid references produtos(id),
  quantidade integer not null,
  observacao text,
  impresso boolean default false
);

create table if not exists operadores (
  id uuid primary key default uuid_generate_v4(),
  nome text,
  login text not null unique,
  senha text not null,
  perfil text not null check (perfil in ('garcom', 'caixa', 'admin')),
  ativo boolean default true
);

insert into operadores (nome, login, senha, perfil, ativo)
values ('Administrador', 'admin', 'admin', 'admin', true)
on conflict (login) do nothing;
