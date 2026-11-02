# Kurio | Marketplace de NFTs

Solução do desafio Frontend da Jungle Gaming: marketplace de NFTs com catálogo, detalhe, carrinho, pagamento com carteira simulada, confirmação de pedido, conta do colecionador e atualizações em tempo real.

Toda a API REST e o servidor Socket.IO são simulados no navegador com **MSW**, então o projeto roda a partir de um checkout limpo, sem backend nem serviços privados.

- **Aplicação publicada:** https://kurio-nft2026.vercel.app
- **Repositório:** https://github.com/Doug1980/dougdev-nft-marketplace
- **Arquitetura e decisões:** [ARCHITECTURE.md](./ARCHITECTURE.md)

## Stack

| Área        | Tecnologia                                                                          |
| ----------- | ----------------------------------------------------------------------------------- |
| UI          | React 19, TypeScript 6 (strict), Tailwind CSS v4, shadcn/ui (Radix)                 |
| Roteamento  | TanStack Router (rotas tipadas, search params validados com Zod, code splitting)    |
| Dados       | TanStack Query + Axios (instância única)                                            |
| Tempo real  | socket.io-client contra um servidor Socket.IO simulado (`@mswjs/socket.io-binding`) |
| Simulação   | MSW 2 (REST + WebSocket), banco simulado persistido em `localStorage`               |
| Formulários | react-hook-form + Zod (os mesmos schemas validam cliente, mocks e respostas)        |
| Testes      | Playwright (E2E + regressão visual, desktop e mobile)                               |
| Auditoria   | Lighthouse 13 (script versionado)                                                   |
| Qualidade   | ESLint (lint) + Biome (formatação)                                                  |

## Requisitos

- Node.js 22 ou superior
- npm 10 ou superior

## Setup

```bash
npm ci
cp .env.example .env            # opcional: os valores padrão já ativam os mocks
npx playwright install chromium # só para testes E2E e Lighthouse
npm run dev                     # http://localhost:5173
```

## Variáveis de ambiente

| Variável            | Padrão                      | Descrição                                                                                       |
| ------------------- | --------------------------- | ----------------------------------------------------------------------------------------------- |
| `VITE_ENABLE_MOCKS` | `true`                      | Liga o MSW (REST + Socket.IO simulados). Com `false`, o app usa uma API real em `VITE_API_URL`. |
| `VITE_API_URL`      | `/api`                      | Base da API REST.                                                                               |
| `VITE_SOCKET_URL`   | `wss://realtime.kurio.mock` | URL do Socket.IO. Com mocks ativos, é interceptada pelo MSW.                                    |

## Comandos

| Comando                   | O que faz                                                                              |
| ------------------------- | -------------------------------------------------------------------------------------- |
| `npm run dev`             | Desenvolvimento com mocks (Vite, porta 5173)                                           |
| `npm run build`           | Typecheck + build de produção em `dist/`                                               |
| `npm run preview`         | Serve o build de produção (porta 4173)                                                 |
| `npm run typecheck`       | Verificação de tipos (`tsc -b`)                                                        |
| `npm run lint`            | ESLint                                                                                 |
| `npm run format`          | Formatação com Biome                                                                   |
| `npm run test:e2e`        | Playwright: faz o build, sobe o preview e roda desktop + mobile                        |
| `npm run test:e2e:update` | Atualiza as screenshots de regressão visual                                            |
| `npm run test:e2e:report` | Abre o relatório HTML do Playwright                                                    |
| `npm run test:e2e:prod`   | Roda a mesma suíte contra a aplicação publicada na Vercel (sem as screenshots visuais) |
| `npm run lighthouse`      | Build + auditoria Lighthouse (3 execuções por página e perfil, mediana)                |

## Credenciais fictícias

| Usuário    | E-mail                   | Senha        | Estado inicial                                                                       |
| ---------- | ------------------------ | ------------ | ------------------------------------------------------------------------------------ |
| Nova Sato  | `colecionador@kurio.dev` | `Kurio@2026` | Carteira principal (MetaMask, Ethereum) e secundária (Coinbase, Polygon), 1 favorito |
| Lia Moraes | `curadora@kurio.dev`     | `Kurio@2026` | Conta vazia, sem carteiras                                                           |

Também é possível criar contas em **Criar conta**.

**Cupons:** `KURIO10` (10%), `GENESIS5` (5%), `VERAO2025` (expirado).
**Taxas de rede:** Ethereum 0.016 ETH, Polygon 0.002 ETH, Solana 0.001 ETH.

## Cenários da simulação

Os cenários mudam o comportamento da API e do socket simulados. Há três formas de selecionar:

1. **Painel "Cenários"**: botão flutuante no canto inferior esquerdo (lateral no mobile). Também dispara eventos em tempo real, derruba o socket, expira a sessão e restaura os dados.
2. **URL**: `?scenario=<id>`, por exemplo `http://localhost:5173/?scenario=slow`. O parâmetro é removido da URL depois de aplicado.
3. **API de controle**: `POST /api/__mock/scenario` com `{ "scenario": "<id>" }` (usada pelos testes).

**Reset dos dados:** `?resetMocks=1` (combinável com `&scenario=<id>`) ou **Restaurar dados iniciais** no painel. O cenário escolhido persiste até ser trocado.

| Cenário            | Comportamento                                                              |
| ------------------ | -------------------------------------------------------------------------- |
| `default`          | Latência variável curta (120 a 380 ms) e pagamento confirmado              |
| `fast`             | Respostas imediatas (testes automatizados)                                 |
| `slow`             | Latência de 2,5 s em todas as chamadas (skeletons)                         |
| `out-of-order`     | Buscas mais recentes respondem antes das antigas                           |
| `empty-catalog`    | Catálogo sem resultados                                                    |
| `offline`          | Falha de rede em todo o REST e no socket                                   |
| `server-error`     | Catálogo e detalhe respondem HTTP 500                                      |
| `flaky`            | A primeira chamada de cada rota responde 503; o retry funciona             |
| `favorites-fail`   | Incluir e remover favoritos respondem 500 (rollback do otimista)           |
| `price-change`     | Ao abrir o pagamento, o preço do primeiro item sobe via `nft.updated`      |
| `sold-out`         | Ao abrir o pagamento, a edição do primeiro item esgota                     |
| `order-timeout`    | O pedido é criado, mas a resposta chega depois do timeout do cliente (8 s) |
| `payment-declined` | O pedido fica pendente e depois é recusado                                 |
| `wallet-rejected`  | A conexão da carteira é recusada                                           |
| `socket-drop`      | O socket cai após a criação do pedido, que confirma enquanto offline       |
| `duplicate-events` | Cada evento chega duas vezes, seguido de uma versão antiga                 |

## Reproduzindo os fluxos de falha

Use o colecionador (`colecionador@kurio.dev`) e comece de `http://localhost:5173/?resetMocks=1`.

| Fluxo                       | Como reproduzir                                                                  | Resultado esperado                                                                     |
| --------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Carregamento lento          | `?scenario=slow`                                                                 | Skeletons no catálogo, detalhe e carrinho                                              |
| Erro 500                    | `?scenario=server-error`                                                         | Mensagem de erro com **Tentar novamente**                                              |
| Sem conexão                 | `?scenario=offline`                                                              | Erro de rede; volte para `default` e use **Tentar novamente**                          |
| Falha transitória           | `?scenario=flaky`                                                                | Nenhum erro visível: o retry automático recupera                                       |
| Respostas fora de ordem     | `?scenario=out-of-order`, clique rápido em dois filtros                          | O resultado final corresponde aos filtros atuais                                       |
| Favorito falha              | `?scenario=favorites-fail`, clique em Favoritar                                  | O coração volta ao estado anterior e aparece o erro                                    |
| Preço muda no carrinho      | Carrinho aberto, painel → **Subir preço do 1º item**                             | Aviso "Preço subiu… Entendi" e total recalculado                                       |
| Edição esgota               | Painel → **Esgotar edição do 1º item**                                           | Alerta, preço riscado e **Conectar e finalizar** bloqueado                             |
| Preço muda na revisão       | Pagamento → **Confirmar compra**; com o diálogo aberto, painel → **Subir preço** | "Os valores mudaram", nova confirmação obrigatória                                     |
| Carteira recusa             | `?scenario=wallet-rejected`, **Conectar carteira**                               | Mensagem e **Tentar conectar novamente**                                               |
| Pagamento recusado          | `?scenario=payment-declined`, conclua a compra                                   | Pendente → "Pagamento recusado", itens continuam no carrinho                           |
| Timeout no pedido           | `?scenario=order-timeout`, conclua a compra                                      | Após o retry com a mesma `Idempotency-Key`, o mesmo pedido é recuperado (sem duplicar) |
| Queda do socket             | `?scenario=socket-drop`, conclua a compra                                        | Aviso de verificação periódica; o recibo chega por polling e reconciliação             |
| Eventos duplicados          | `?scenario=duplicate-events` + **Subir preço**                                   | O preço aplicado é sempre o mais recente                                               |
| Sessão expirada             | Em `/pagamento`, digite algo e use **Expirar sessão** no painel                  | Login com aviso; após entrar, volta ao pagamento com o rascunho preservado             |
| Refresh com pedido pendente | Durante "Aguardando confirmação", recarregue a página                            | O status é recuperado via REST, sem nova compra                                        |

## Testes E2E

```bash
npx playwright install chromium   # primeira vez
npm run test:e2e
```

- Rodam contra o **build de produção** servido pelo `vite preview`, com mocks ativos.
- Dois projetos: `desktop-chromium` (1440 × 900) e `mobile-chromium` (390 × 844, touch). Testes marcados com `@mobile` rodam nos dois.
- Cada teste usa um contexto novo do navegador (banco simulado semeado do zero).
- Eventos de tempo real passam pelo cliente Socket.IO; chamadas REST passam pelos handlers MSW. Nenhum evento é injetado direto na interface.
- **Regressão visual:** as baselines são por plataforma (`-linux.png`, `-win32.png`). Em uma plataforma nova, a primeira execução cria as suas.
- **Tempo controlado:** a latência vem do cenário `fast` (sem atraso) ou do cenário em teste; eventos de tempo real, expiração de sessão e mudanças de estoque são disparados pelas rotas de controle da simulação (`/api/__mock/*`), e a liquidação do pedido tem duração fixa. Nenhum teste depende de espera aleatória.
- **Relatório e traces:** `npm run test:e2e:report` abre o relatório HTML; em falhas, screenshot e trace ficam em `test-results/` (`npx playwright show-trace <arquivo>`).
- **Responsividade:** além dos viewports dos testes (390 e 1440), as telas foram verificadas sem rolagem horizontal em 320, 768 e 1024 px (320 px equivale ao zoom de 400% em uma tela de 1280 px).

| Arquivo             | Cobertura                                                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `catalog.spec.ts`   | Busca, filtros, ordenação, paginação na URL, refresh e histórico; respostas fora de ordem                                    |
| `detail.spec.ts`    | Acesso direto, edição esgotada, limite de quantidade, NFT e rota inexistentes                                                |
| `cart.spec.ts`      | Quantidades, remoção, cupom, persistência após refresh e após login                                                          |
| `purchase.spec.ts`  | Compra completa, pagamento recusado, clique duplo sem duplicar, timeout com idempotência, carteira recusada                  |
| `realtime.spec.ts`  | Preço muda na revisão, esgotamento ao vivo, eventos duplicados e antigos, queda do socket com pedido pendente, reconciliação |
| `auth.spec.ts`      | Cadastro, login inválido, sessão expirada preservando o destino, troca de usuário sem vazar dados                            |
| `account.spec.ts`   | Perfil, avatar, senha, carteiras principal e secundária                                                                      |
| `favorites.spec.ts` | Persistência, rollback do otimista, visitante levado ao login                                                                |
| `loading.spec.ts`   | Skeletons, HTTP 500, sem conexão, falha transitória, catálogo vazio                                                          |
| `a11y.spec.ts`      | Skip link, foco preso e devolvido nos diálogos, erros associados aos campos, operação por teclado                            |
| `mobile.spec.ts`    | Busca e filtros pelo drawer, ausência de rolagem horizontal                                                                  |
| `visual.spec.ts`    | Screenshots de Início, Detalhe, Carrinho e Pagamento (desktop e mobile)                                                      |

## Lighthouse

```bash
npm run lighthouse
```

O script (`scripts/lighthouse.mjs`) faz o build, serve com `vite preview` (mocks ativos, cenário padrão) e audita **Início** e **Detalhe do NFT** nos perfis **mobile** e **desktop**, com **3 execuções** por combinação, cada uma em um perfil novo do Chrome. Os relatórios HTML e JSON ficam em `.lighthouse/reports/`, e a mediana em `.lighthouse/summary.md` e `.lighthouse/summary.json`.

**Ambiente da medição registrada:** Lighthouse 13.6.0, Chromium headless 156 (Playwright), Node 22.20, Windows 11 (10.0.26200), Intel Core i7-13650HX, throttling padrão do Lighthouse (mobile: CPU 4× e rede 4G lenta simulados).

| Página  | Perfil  | Performance | Accessibility | Best Practices | SEO |     LCP |   CLS |    TBT |
| ------- | ------- | ----------: | ------------: | -------------: | --: | ------: | ----: | -----: |
| Início  | mobile  |          88 |            96 |            100 |  92 | 3494 ms | 0.000 | 198 ms |
| Início  | desktop |         100 |            97 |            100 |  92 |  698 ms | 0.002 |   0 ms |
| Detalhe | mobile  |          89 |           100 |            100 |  92 | 3613 ms | 0.000 | 105 ms |
| Detalhe | desktop |         100 |           100 |            100 |  92 |  734 ms | 0.000 |   0 ms |

Metas: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 90. Accessibility, Best Practices e SEO atingem a meta em todas as combinações; Performance atinge no desktop (100) e fica a 1 e 2 pontos da meta no mobile.

**Por que o mobile fica logo abaixo de 90:** a métrica que pesa é o **LCP** (cerca de 3,5 a 3,6 s no celular simulado, com CPU 4× mais lenta e rede 4G lenta); TBT e CLS estão bons. O LCP depende de o app renderizar, e o app só renderiza depois que o **backend simulado** está de pé dentro do navegador: o chunk do MSW (banco simulado, regras de negócio e servidor Socket.IO, 54 KB gzip) precisa ser baixado e o Service Worker precisa ser registrado antes da primeira requisição. Com uma API real, esse chunk e essa espera não existiriam. A auditoria não desliga os mocks nem simplifica a página, porque o desafio exige auditar a entrega real.

**Otimizações aplicadas a partir da auditoria:**

- **`tough-cookie` substituído por um stub** (`src/mocks/tough-cookie-stub.ts`, alias no `vite.config.ts`): o MSW usa essa biblioteca só para emular cookies, que o app não usa (autenticação por Bearer). O chunk do MSW caiu de 475 KB (175 KB gzip) para 181 KB (54 KB gzip), e o LCP mobile de ~4,8 s para ~3,5 s.
- **`modulepreload` dos chunks da inicialização** (plugin no `vite.config.ts`): MSW, sessão e app baixam em paralelo com o script de entrada, em vez de em fila.
- O painel de cenários só é carregado depois do evento `load`, sem disputar banda com o conteúdo.
- O código do app é baixado **em paralelo** com a inicialização do MSW, e o `socket.io-client` é carregado sob demanda (fora do bundle inicial).
- `preload` da imagem que é LCP (destaque no desktop, primeiro card no mobile).
- `min-height` no conteúdo principal: eliminou o CLS de 0,218 causado pelo rodapé subindo enquanto a página lazy carregava.
- Code splitting por rota; o painel de cenários fica em um chunk separado e não é carregado com mocks desligados.
- Imagens WebP com dimensões explícitas, fontes locais (sem requisições externas) e sem autoplay no carrossel.
