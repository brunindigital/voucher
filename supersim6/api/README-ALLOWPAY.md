# Integração AllowPay (PIX) — SuperSim funil

Integra a API PIX da AllowPay ao checkout **sem alterar o front**. O `js/checkout-shared.js`
já chama `POST /api/pix` e faz polling em `GET /api/status?id=` — estas funções implementam
exatamente esse contrato.

## Arquivos

| Arquivo | Papel |
|---|---|
| `api/_lib/allowpay.js` | Lib server-side: chave, tabela de preços, validação de CPF, chamadas à AllowPay, codificação do `txnId` (carrega `route`+`txid`). |
| `api/pix.js` | `POST /api/pix` → cria a cobrança e devolve `{ success, qrcode, txnId, amount }`. |
| `api/status.js` | `GET /api/status?id=` → decodifica `route`+`txid` e consulta o status → `{ paid, status }`. |
| `api/webhook-allowpay.js` | `POST /api/webhook-allowpay` → recebe a confirmação, valida HMAC-SHA256. Opcional. |
| `api/_lib/utmify.js` | Lib do UTMify (Orders API): monta e envia o pedido. Token só no servidor. |
| `api/utmify-paid.js` | `POST /api/utmify-paid` → marca a venda como `paid` no UTMify (disparado pelo checkout na confirmação). |

## Rastreamento UTMify (server-side)

Além do **pixel** UTMify (já no front), a venda PIX é registrada na **Orders API** do UTMify:

- **`waiting_payment`** → enviado no `/api/pix` (tem cliente + produto + UTMs).
- **`paid`** → enviado no `/api/utmify-paid`, disparado pelo checkout (`_pixFirePurchase`) no
  instante da confirmação. Usa o **mesmo `orderId`** (o `txid` da AllowPay) → o UTMify faz upsert.
- **Por que o front dispara o `paid`?** O UTMify exige o payload COMPLETO em toda chamada (cliente +
  UTMs). Sem banco de dados, quem tem esses dados na confirmação é o navegador (localStorage). O
  token do UTMify continua **só no servidor** — o navegador só reenvia os dados que já são dele.
- `createdAt` real viaja dentro do `txnId` (base64 de `{route, txid, createdAt}`), então o `paid`
  mantém a data de criação correta sem storage.

Env: `UTMIFY_API_TOKEN` (obrigatório) · `UTMIFY_TEST=1` p/ enviar como teste (deixe vazio em produção).

## Como funciona (decisões-chave)

- **A `api_key` fica SÓ no servidor** (env `ALLOWPAY_API_KEY`). Nunca vai pro navegador.
- **Preço vem do servidor** (`PRODUCTS` em `_lib/allowpay.js`, espelho do `PIX_PRODUCTS`). O cliente
  manda só o `upKey`; o valor nunca é confiado ao cliente.
- **Sem `route` fixo** no create-pix → a AllowPay escolhe a adquirente (preferida + fallback).
- **`route` guardado junto do `txid`**: como o site é estático (sem banco), o `txnId` devolvido ao
  front é `base64url({route, txid})`. O `/api/status` decodifica e chama a AllowPay com os dois.
- **CPF/telefone**: sanitizados; se inválidos/vazios, geramos um CPF válido / telefone padrão pra
  não tomar rejeição (a AllowPay rejeita CPF com dígito inválido).
- **Confirmação**: o front confirma via **polling** do `/api/status` (a cada 3s). O **webhook** é
  reconciliação/opcional — ative com `ALLOWPAY_WEBHOOK_SECRET` (só é enviado em HTTPS público).

## Deploy na Vercel

1. Coloque a pasta `api/` na **raiz do deploy** (a mesma raiz que serve `1.html`, `up1/`, etc.).
2. Em **Settings → Environment Variables**, defina:
   - `ALLOWPAY_API_KEY` = sua chave
   - `ALLOWPAY_WEBHOOK_SECRET` = (opcional) um segredo forte
3. Deploy. A Vercel detecta `api/*.js` como funções automaticamente (Node 18+, `fetch` global).
4. (Recomendado) remova o fallback hardcoded da chave em `api/_lib/allowpay.js` depois de setar a env.

## Teste local (sem Vercel)

`npx serve` é estático e NÃO roda `/api`. Use o dev-server incluído na raiz do projeto:

```bash
node dev-server.js   # http://localhost:4321  (serve o site + executa /api/*)
```

## Central de suporte (WhatsApp)

- Página pública: `/suporte.html`. Painel: `/painel-suporte.html`.
- No login, "Visualizar demonstração sem senha" abre os campos sem consultar a API.
  Esse modo apenas valida a prévia; não salva nem publica alterações e não libera
  acesso administrativo. Para editar o contato real, saia da demonstração e entre com a senha.
- A notificação de suporte na conta abre a central. Nenhum contato fictício é publicado:
  até cadastrar um número, o botão permanece desabilitado.
- Todos os acessos à antiga aba de saque na conta (atalhos, desbloqueio e navegação
  inferior) redirecionam para `/suporte.html`, inclusive no modo demonstrativo.
  As abas de início e dados continuam funcionando na conta.
- O painel permite editar nome, número internacional (país + DDD) e mensagem inicial.
  A configuração fica no Upstash Redis, compartilhada entre visitantes e persistente
  após novos deploys. Não usa localStorage nem arquivos gravados nas funções Vercel.
- Na central, o visitante escolhe um assunto e revisa nome, CPF e e-mail preenchidos
  a partir dos dados da conta neste navegador. Campos vazios são omitidos; os dados
  podem ser corrigidos ou apagados e não são enviados à API de suporte. O botão
  fica disponível assim que o contato é carregado, sem caixa de confirmação.
  O assunto vem pré-selecionado como "Voucher bloqueado"; o visitante pode trocá-lo.
  A mensagem inclui o texto inicial configurado no painel, o assunto e os dados
  revisados. Ao abrir o WhatsApp, eles são incluídos na URL; o envio na conversa
  depende de confirmação dentro do WhatsApp.
- Na Vercel, mantenha **Root Directory = `supersim6`**, sem build obrigatório
  (Framework Preset: Other). Conecte um banco **Upstash Redis** pelo Marketplace.
  Defina `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` e
  `SUPPORT_ADMIN_PASSWORD` (senha aleatória exclusiva com pelo menos 16 caracteres).
  Habilite as variáveis para o ambiente desejado e faça novo deploy.
- Abra o painel, entre com a senha, cadastre o número e salve. Use a prévia para testar
  o destino e abra a página pública para confirmar. A mensagem só é enviada quando
  o visitante confirma o envio dentro do WhatsApp.
- A senha é enviada por HTTPS e mantida somente em memória na página; recarregar ou
  sair exige novo login. As operações protegidas têm limite de 30 tentativas por IP
  a cada 15 minutos. Senhas e tokens não devem ser incluídos no GitHub.
- Falhas de banco/configuração aparecem na interface; não há número alternativo
  silencioso. O acesso administrativo falha fechado se a senha não estiver configurada.
- Para testes locais, exporte as mesmas variáveis no terminal antes de iniciar
  `node dev-server.js` (o servidor não carrega `.env` automaticamente).
- Testes isolados da API: `node --test tests/support.test.js`, na raiz do repositório.
- A página identifica o canal como suporte **deste site**, sem afirmar vínculo oficial
  com empresas terceiras ou exibir selos de verificação não comprovados.
