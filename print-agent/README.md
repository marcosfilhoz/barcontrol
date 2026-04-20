# Print Agent

Agente local para rodar no PC do caixa e imprimir itens novos via TCP (porta 9100).

## Instalar

```bash
npm install
```

## Configurar

1. Crie `.env` baseado em `env.example`.
2. Preencha:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `PRINTER_HOST`
   - `PRINTER_PORT` (opcional, padrao `9100`)

## Rodar

```bash
npm start
```

O agente escuta inserts em `pedido_itens` e:

- ignora itens ja impressos
- agrupa por **comanda** (`pessoa_id` na mesa): espera um curto intervalo (`PRINT_DEBOUNCE_MS`, padrao 450ms) e imprime **um unico cupom** com todos os itens pendentes daquela pessoa no pedido (igual ao bloco Pedido + Cliente na tela Cozinha), depois marca `impresso = true` em todos
- texto em **caixa alta** e tamanho maior na impressora (ESC/POS)
- se nao houver `mesa_id` (caso raro), imprime um item so como antes

**Importante:** isso e o fluxo que realmente manda para a impressora na rede. A tela web `/cozinha` e outro caminho (impressao pelo navegador). Apos atualizar o agente, rode `npm start` de novo no PC do caixa/cozinha.
