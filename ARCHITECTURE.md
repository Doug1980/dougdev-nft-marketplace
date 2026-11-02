# Arquitetura

Este documento descreve como a aplicação está organizada, os contratos REST e de eventos, as políticas de sessão, carrinho e cache, a reconciliação entre REST e Socket.IO, e as decisões de UX, limitações e desvios do Figma.

## Visão geral

```text
┌──────────────────────────── navegador ────────────────────────────┐
│                                                                    │
│  React (pages, components)                                         │
│     │ hooks de domínio (src/features)                              │
│     ▼                                                              │
│  TanStack Query ── Axios (src/api) ──────────┐  REST /api/*        │
│     ▲                                        ▼                     │
│     │ patch/invalidate            Service Worker do MSW            │
│  RealtimeClient (src/realtime) ◄── socket ── servidor Socket.IO    │
│     socket.io-client               simulado (src/mocks/realtime)   │
│                                        │                           │
│                       regras de negócio + banco simulado           │
│                       (src/mocks/domain, src/mocks/db → localStorage)
└────────────────────────────────────────────────────────────────────┘
```

O backend inteiro é simulado no navegador. A interface não chama o banco simulado diretamente: toda leitura e escrita passa por HTTP (Axios → MSW) e todo evento em tempo real passa pelo cliente Socket.IO. Trocar os mocks por uma API real exige apenas `VITE_ENABLE_MOCKS=false` e as URLs reais.

## Estrutura de pastas

| Pasta            | Responsabilidade                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `src/api`        | Contratos Zod (`contracts.ts`), instância Axios (`http.ts`), erros normalizados (`errors.ts`) e funções por recurso (`endpoints.ts`) |
| `src/features`   | Hooks de domínio com TanStack Query: catálogo, carrinho, pedidos, autenticação, conta, favoritos                                     |
| `src/realtime`   | Cliente Socket.IO, aplicação de eventos no cache e provider React                                                                    |
| `src/pages`      | Uma tela por arquivo, carregada sob demanda (code splitting por rota)                                                                |
| `src/components` | `ui` (shadcn/ui adaptado aos tokens do Figma), `shared`, `layout`, `home`, `checkout`                                                |
| `src/lib`        | Sessão, chaves e política de cache, dinheiro (big.js), anúncios para leitor de tela, utilitários de formulário                       |
| `src/mocks`      | MSW: handlers REST, servidor Socket.IO, regras de negócio, banco simulado, seed e cenários                                           |
| `tests`          | Playwright (E2E e regressão visual)                                                                                                  |
| `scripts`        | Auditoria Lighthouse                                                                                                                 |

## Contratos

Os schemas Zod em `src/api/contracts.ts` são a fonte única de verdade:

- as respostas da API são **validadas no cliente** (`parse` em cada endpoint); uma resposta fora do contrato vira `CONTRACT_ERROR`, nunca dado corrompido na tela;
- os handlers do MSW validam as entradas com os **mesmos** schemas;
- os formulários usam os mesmos schemas via `zodResolver`.

**Valores em ETH** trafegam como strings decimais (`"1.19"`) e toda a aritmética usa `big.js`, sem erro de ponto flutuante.

**Erros** seguem um envelope único `{ error: { code, message, fields?, details? } }`. O cliente normaliza tudo em `ApiError` (`status`, `code`, `fields`, `isTransient`), inclusive timeout (`TIMEOUT`), falta de rede (`NETWORK_ERROR`) e cancelamento (`CANCELED`). Erros de validação trazem `fields`, que os formulários aplicam no campo certo (`applyApiErrors`).

### REST (`/api`)

| Método       | Rota                          | Auth     | Descrição                                                                                          |
| ------------ | ----------------------------- | -------- | -------------------------------------------------------------------------------------------------- |
| POST         | `/auth/register`              | Não      | Cria conta e sessão                                                                                |
| POST         | `/auth/login`                 | Não      | Cria sessão                                                                                        |
| GET          | `/auth/session`               | Sim      | Revalida a sessão persistida (boot)                                                                |
| POST         | `/auth/logout`                | Sim      | Revoga a sessão                                                                                    |
| GET          | `/nfts`                       | Não      | Catálogo: `q`, `tab`, `categories`, `networks`, `minPrice`, `maxPrice`, `sort`, `page`, `pageSize` |
| GET          | `/nfts/:idOrSlug`             | Não      | Detalhe com edições, estoque e versão                                                              |
| GET          | `/favorites`                  | Sim      | IDs favoritos do usuário                                                                           |
| PUT / DELETE | `/favorites/:nftId`           | Sim      | Favoritar / desfavoritar                                                                           |
| GET          | `/cart`                       | Opcional | Carrinho do usuário ou do visitante (`X-Cart-Id`)                                                  |
| POST         | `/cart/items`                 | Opcional | Adiciona item (valida edição, estoque e limite por pedido)                                         |
| PATCH        | `/cart/items/:itemId`         | Opcional | Altera quantidade ou confirma ciência de preço (`acknowledgePrice`)                                |
| DELETE       | `/cart/items/:itemId`         | Opcional | Remove item                                                                                        |
| PUT / DELETE | `/cart/coupon`                | Opcional | Aplica / remove cupom (validação no servidor)                                                      |
| POST         | `/cart/merge`                 | Sim      | Mescla o carrinho do visitante no da conta                                                         |
| POST         | `/quotes`                     | Opcional | Cotação: linhas, subtotal, desconto, taxa da rede, total, `fingerprint` e `issues`                 |
| POST         | `/orders`                     | Sim      | Cria pedido. Exige `Idempotency-Key`, `quoteFingerprint` e sessão de carteira ativa                |
| GET          | `/orders?status=pending`      | Sim      | Pedidos pendentes (retomada)                                                                       |
| GET          | `/orders/:orderId`            | Sim      | Pedido (404 se for de outro usuário)                                                               |
| GET / PATCH  | `/profile`                    | Sim      | Perfil                                                                                             |
| PUT / DELETE | `/profile/avatar`             | Sim      | Avatar (data URL validada)                                                                         |
| POST         | `/profile/password`           | Sim      | Troca de senha                                                                                     |
| GET / POST   | `/wallets`                    | Sim      | Carteiras (principal e secundária)                                                                 |
| PUT          | `/wallets/:walletId`          | Sim      | Edita carteira                                                                                     |
| POST         | `/wallet-sessions`            | Sim      | Conecta carteira em uma rede (pode ser recusada)                                                   |
| DELETE       | `/wallet-sessions/:sessionId` | Sim      | Desconecta                                                                                         |

Rotas de controle da simulação (`/api/__mock/*`: estado, cenário, reset, expirar sessão, alterar edição, derrubar socket) não fazem parte do contrato do produto. São usadas pelo painel de cenários e pelos testes.

### Eventos Socket.IO

O cliente conecta com `transports: ['websocket']` e envia o token na query. Eventos de saída:

| Evento (cliente → servidor) | Payload                | Efeito                                    |
| --------------------------- | ---------------------- | ----------------------------------------- |
| `subscribe`                 | `{ nftIds: string[] }` | Passa a receber `nft.updated` desses NFTs |
| `unsubscribe`               | `{ nftIds: string[] }` | Deixa de receber                          |

Eventos de entrada compartilham um envelope com identidade, recurso e versão:

```ts
{ eventId: string, resource: { type: 'nft' | 'order', id: string }, version: number, occurredAt: string }
```

| Evento (servidor → cliente) | Dados                                                                                      | Escopo                            |
| --------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------- |
| `nft.updated`               | `nftId`, `price`, `compareAtPrice`, `totalAvailable`, `editions[{ id, price, available }]` | Conexões inscritas no NFT         |
| `order.updated`             | `userId`, `orderId`, `status`, `txHash`, `rejectionReason`                                 | Apenas conexões do dono do pedido |

## Política de sessão

- **Fonte de verdade fora do React** (`src/lib/session-store.ts`), compartilhada por Axios, socket e router. Persiste só token, usuário e expiração; nunca a senha.
- **Expiração:** 30 minutos no servidor simulado. No boot, `restoreSession()` revalida o token antes da primeira renderização (rotas privadas não piscam a tela de login). Falha transitória mantém a sessão local; 401 a encerra.
- **Expiração durante o uso:** qualquer resposta `SESSION_EXPIRED` limpa a sessão no interceptor do Axios. O `SessionWatcher` remove o cache privado, anuncia a expiração e, em tela privada, leva ao login com `redirect` e `reason=expired`. O checkout guarda um rascunho do formulário em `sessionStorage`, então o usuário volta e encontra o que digitou.
- **Rotas privadas** (`/pagamento`, `/pedidos/*`, `/perfil/*`) usam `beforeLoad: requireAuth`. O retorno pós-login aceita apenas caminhos internos (`safeRedirect`, contra open redirect).
- **Troca de usuário e logout:** todo dado privado tem chave `['private', userId, ...]` e é removido (`clearPrivateCache`); o socket da sessão anterior é fechado e eventos de outro `userId` são ignorados. Isso é coberto por teste.

## Estado do carrinho

- **O carrinho vive no servidor.** Visitantes são identificados pelo header `X-Cart-Id`; o id é criado antes da primeira escrita (`ensureGuestCart`) para que nenhuma escrita caia em um carrinho não rastreado.
- **Login:** a mescla (`POST /cart/merge`) roda com o novo token **antes** de trocar a sessão e o resultado já entra no cache da conta. Assim, nenhuma resposta antiga sobrescreve o carrinho mesclado (bug encontrado pelos testes E2E e corrigido).
- **Mutações em série:** todas usam `scope: { id: 'cart' }` do TanStack Query, então cliques rápidos nunca disputam entre si.
- **Totais sempre da API:** o resumo exibe a cotação (`POST /quotes`); o cliente não soma valores. Itens esgotados ficam fora da cotação e aparecem riscados na linha.
- **Mudança de preço:** cada item guarda `addedPrice`. Se o preço atual difere, o item mostra "era X, agora Y" e exige ciência (`acknowledgePrice`). Esgotado ou estoque insuficiente bloqueia a finalização.

## Pedido e idempotência

1. O checkout revisa sempre uma **cotação nova**; o pedido envia o `quoteFingerprint` revisado.
2. O servidor recalcula a cotação. Se preço, estoque, cupom ou taxa mudaram, responde `409 QUOTE_STALE` com a cotação nova, e o diálogo exige nova confirmação. O usuário nunca paga um valor diferente do que viu.
3. Cada tentativa tem uma `Idempotency-Key` persistida em `localStorage` com o payload. Duplo clique, retry após timeout ou reload reutilizam a mesma chave e recebem **o mesmo pedido**; a mesma chave com outro payload recebe `409 IDEMPOTENCY_CONFLICT`.
4. O pedido nasce `pending` e é liquidado pela rede simulada (`confirmed` ou `rejected`). A mudança chega por `order.updated`; enquanto pendente, há polling a cada 5 s como fallback.
5. O recibo mostra o **snapshot** gravado no pedido, não o catálogo atual.

## Estratégia de cache (TanStack Query)

| Dado     | Chave                                | Política                                                                                                   |
| -------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Catálogo | `['catalog', query]`                 | `staleTime` 30 s, `keepPreviousData`, `AbortSignal` (busca antiga é cancelada), prefetch no loader da rota |
| Detalhe  | `['nft', idOrSlug]`                  | `staleTime` 30 s, prefetch no loader; reaproveitado pela lista de favoritos                                |
| Carrinho | `['cart', owner]`                    | `owner` é `guest` ou `user:<id>`; atualizado com a resposta de cada mutação                                |
| Cotação  | `['quote', owner, network, context]` | `staleTime` 0; invalidada a cada mutação do carrinho                                                       |
| Privados | `['private', userId, ...]`           | Perfil, carteiras, favoritos, pedidos; removidos no logout e na troca de usuário                           |

- **Retry** apenas para falhas transitórias (rede, timeout, 5xx), com backoff exponencial; 4xx nunca é repetido. Mutações não repetem, exceto criação de pedido (idempotente).
- **Favoritos** são otimistas com rollback em caso de erro.
- **Estado de catálogo na URL:** busca, filtros, ordenação e página são search params validados com Zod (`.catch` descarta valores inválidos) e sobrevivem a refresh e histórico.

## Reconciliação REST × Socket.IO

- **REST é a fonte de verdade; o socket acelera.** Eventos `nft.updated` corrigem preço e estoque no cache do detalhe e de todas as páginas do catálogo em memória. Carrinho e cotação são revalidados via REST, porque dependem de regras do servidor.
- **Deduplicação:** cada `eventId` é processado uma vez.
- **Ordem:** cada recurso guarda a última versão conhecida, inclusive a vinda do REST (`observeVersion`). Evento com versão menor ou igual é descartado, então eventos atrasados ou duplicados nunca regridem o estado.
- **Assinaturas com contagem de referência:** várias telas podem assinar o mesmo NFT; a desinscrição só ocorre quando o último consumidor desmonta. Na reconexão, as assinaturas são refeitas.
- **Reconexão:** ao reconectar, todas as queries ativas são invalidadas (`invalidateQueries({ type: 'active' })`), recuperando o que mudou enquanto o socket esteve fora. Coberto pelos cenários `socket-drop` e pelo teste de reconciliação.
- **Inicialização:** o `socket.io-client` é carregado sob demanda depois que o MSW intercepta o WebSocket. O resto do app baixa em paralelo com o MSW.

## Simulação (MSW)

- **Banco simulado** em `localStorage` (`kurio:mockdb`), com seed determinístico: 54 NFTs (9 vindos do Figma), 2 usuários, carteiras e cupons. Senhas guardadas como hash SHA-256 com salt.
- **Regras de negócio no "servidor":** estoque e limite por pedido, cupons, taxas por rede, cotação com fingerprint, idempotência, liquidação do pedido e permissões por usuário (pedido de outro usuário responde 404).
- **Cenários** determinísticos (sem aleatoriedade), descritos no README.
- **Servidor Socket.IO** via `@mswjs/socket.io-binding`, com ping manual do Engine.IO a cada 20 s, autenticação pela query e escopo de eventos por inscrição e por usuário.

## Transporte do tempo real no ambiente de mocks

- O servidor Socket.IO é simulado com `@mswjs/socket.io-binding` sobre a interceptação de **WebSocket** do MSW. O cliente usa o `socket.io-client` real, com `transports: ['websocket']`.
- **Limitações:**
  - não há fallback para HTTP long-polling (o binding intercepta apenas WebSocket), por isso o transporte é forçado para WebSocket;
  - o binding não envia os pings do Engine.IO; o servidor simulado envia o ping manualmente a cada 20 s para a conexão não cair por timeout;
  - o "servidor" vive na mesma aba: cada aba tem seu próprio servidor e banco, então eventos não atravessam abas ou dispositivos;
  - o `socket.io-client` é carregado depois que o MSW intercepta o WebSocket, porque o `engine.io-client` guarda a referência do `WebSocket` global ao ser avaliado.
- Em uma API real, basta `VITE_ENABLE_MOCKS=false` e `VITE_SOCKET_URL` apontando para o servidor; nenhum código do cliente muda.

## Assets

- Fontes **Roboto Mono** (400, 500 e 700) servidas localmente via `@fontsource`, sem requisições externas.
- As artes dos NFTs são as 4 ilustrações exportadas do Figma (`public/nfts/*.webp`, convertidas para WebP). O catálogo simulado tem 54 NFTs para exercitar filtros e paginação, então as artes se repetem entre itens com nomes, coleções, preços e atributos diferentes. Os 9 NFTs do Figma mantêm nome e arte originais.
- Ícones da interface: `lucide-react`; logos de redes sociais e login social: SVGs próprios em `brand-icons.tsx`; favicon próprio do Kurio.

## Acessibilidade

- Skip link para o conteúdo, foco visível em todos os controles e títulos de página por rota.
- Diálogos e drawers do Radix: foco preso, Esc fecha e o foco volta ao gatilho (inclusive na busca aberta por estado).
- `FormField` associa label, dica e erro (`aria-invalid`, `aria-describedby`); obrigatoriedade anunciada além do asterisco visual.
- Regiões `aria-live` (`announce()`) para mutações e eventos em tempo real; toggles com `aria-pressed`; edições como `RadioGroup` navegável por setas.
- Respeito a `prefers-reduced-motion`; carrossel sem autoplay.

## Decisões de UX

- **Nada finge sucesso.** Login social, recuperação de senha, newsletter e as seções Criadores, Aprenda, Atividade, Ofertas, Arquivos e Suporte mostram um aviso explícito de que não fazem parte da demonstração.
- **Carteira e rede andam juntas:** escolher uma carteira seleciona a rede dela; trocar a rede desconecta a carteira, porque a sessão de carteira vale para uma rede.
- **Painel de cenários** no próprio app, para o avaliador reproduzir falhas sem editar a URL.
- **Explorador simulado:** "Ver no Etherscan/Polygonscan/Solscan" (conforme a rede) leva a uma página interna que deixa claro que o hash é simulado, em vez de um link externo que daria 404.

## Desvios do Figma

| Tela              | Desvio                                                                 | Motivo                                                               |
| ----------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Início (mobile)   | Hero compacto adaptado e grade escalonada do catálogo                  | Seguem o frame mobile; o destaque usa as artes disponíveis           |
| Detalhe           | Aba "Avaliações" mostra nota e quantidade, sem comentários individuais | Não há dados de avaliações no escopo                                 |
| Formulários ENS   | Prefixo visual ".eth" substituído por dica "Sem o sufixo .eth"         | Evita um campo visualmente dividido que confundia o rótulo acessível |
| Carrinho (mobile) | Placeholder do cupom encurtado para "Código promocional"               | O texto do Figma era cortado em 375 px                               |
| Carrinho          | Preço riscado em item esgotado; avisos de preço e estoque              | Estados não desenhados no Figma, exigidos pelos fluxos de falha      |
| Confirmação       | Nome do explorador conforme a rede                                     | O Figma mostra só Etherscan                                          |
| Geral             | Estados de carregamento, erro, vazio, pendente e recusado              | Não desenhados; seguem os tokens e componentes do Figma              |

## Limitações

- O backend roda no navegador: os dados são por navegador (`localStorage`) e não sincronizam entre dispositivos ou abas diferentes em tempo real.
- **Performance mobile no Lighthouse** fica abaixo de 90 (76 no Início, 83 no Detalhe) por causa do custo do backend simulado no carregamento; detalhes e medições no README.
- Login social, recuperação de senha e as seções editoriais estão fora do escopo (com aviso explícito na interface).
- Autenticação, hash de senha e "blockchain" são simulações para fins de demonstração, sem garantias de segurança reais.
