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
- busca os detalhes do item
- envia para a impressora via TCP
- marca `impresso = true`
