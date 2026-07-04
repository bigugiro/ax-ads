# AX Ads — Plano de Construção (Build Spec)

### SaaS de tráfego pago + automação + IA · vertical e-commerce · **mobile-first**

**Destino:** execução pelo Claude Code no VS Code, sprint a sprint.
**Filosofia:** produto completo, **qualidade primeiro**, prazo = o adequado. Sem MVP fatiado.

> Este documento é a fonte de verdade da construção. O `CLAUDE.md` (arquivo separado) é o contrato operacional que o agente deve seguir em toda tarefa.

---

## 0. Como o Claude Code deve usar este plano

1. Ler o `CLAUDE.md` da raiz **antes de qualquer tarefa** — ele tem as regras não-negociáveis.
2. Construir **um sprint por vez**, na ordem da Seção 8. Não pular sprint.
3. **Definição de Pronto (DoD) por sprint** inclui testes passando. Feature sem teste = não pronta.
4. Toda tabela nova nasce com **RLS** e política de isolamento por `agencia_id`.
5. **Mobile-first sempre**: estilo base é mobile; `md:`/`lg:` só pra ampliar.
6. Nunca logar token/segredo. Nunca burlar RLS. Ver Seção 9.

---

## 0.1 Status de execução & ambiente (atualizado 2026-07-04)

**Onde estamos:** Sprint 0 construído porém **não fechado** — monorepo, CI, shell mobile (bottom-nav + PWA), auth, papéis, migrations de tenancy (`agencias`, `usuarios`, `clientes`, `audit_log`) com RLS e testes escritos. Bloqueios: zero commits no git, `node_modules` corrompido (vitest não inicia), script `typecheck` quebrado (TS6310 com project references).

**Mudanças de contexto:**

- **Unidade `D:` disponível (256 GB).** O repo deve migrar para `D:\ax-ads`, fora do OneDrive — o OneDrive desidratou arquivos e corrompeu o `node_modules` (há um `node_modules_broken_*` órfão na raiz a remover).
- **Credenciais em `.env.local`:** tokens de Supabase (access token, service role, DATABASE_URL), Vercel e GitHub já configurados. **Nunca commitar nem logar** — `.env.local` fica no `.gitignore`.
- **Billing trocado: Stripe → Pagar.me** (API v5 — assinaturas com cartão/Pix/boleto). Refletido nas Seções 2, 4, 8 (Sprint 11) e 12.

**Próximo passo obrigatório:** Sprint 0.5 (tabela da Seção 8) — recuperar o ambiente e fechar o Sprint 0 com CI verde antes de qualquer feature nova.

---

## 1. Decisões travadas (produto completo)

| Tema                | Decisão                                                                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Escopo              | Produto completo (todos os módulos), não MVP                                                                                              |
| Prioridade          | Qualidade > velocidade. Prazo adequado à qualidade.                                                                                       |
| Design              | **Mobile-first** (gestor opera do celular) + PWA instalável                                                                               |
| Multi-tenant        | Sim, RLS por `agencia_id` desde o schema inicial                                                                                          |
| Público-cliente     | E-commerce                                                                                                                                |
| Conexão de contas   | **OAuth**: gestor conecta contas que já acessa (Business Manager/MCC dele). Token por conta de anúncio, escopo por agência. _(revisável)_ |
| Feature de destaque | **Aba Estratégias** (Seção 6) — biblioteca de padrões comprovados                                                                         |
| Motor de valor      | PDCA / melhoria contínua sobre cada conta (Seção 7)                                                                                       |

---

## 2. Stack definitivo

| Camada      | Tecnologia                                                                                     |
| ----------- | ---------------------------------------------------------------------------------------------- |
| Front       | React + Vite + TailwindCSS (mobile-first), React Router, TanStack Query, React Hook Form + Zod |
| UI/PWA      | Componentes próprios + headless (Radix/shadcn opcional), vite-plugin-pwa                       |
| Back        | Node.js + Express (Vercel Functions)                                                           |
| Dados/Auth  | Supabase (PostgreSQL + Auth + Storage) com **RLS**                                             |
| Jobs        | Vercel Cron (sync diário, detecção de anomalia) + fila leve p/ webhooks                        |
| IA          | Claude **Haiku** (classificação/volume) + **Sonnet** (geração/análise/recomendação)            |
| Integrações | Meta Marketing API, Google Ads API, Conversions API (CAPI)                                     |
| Billing     | **Pagar.me** (API v5 — assinaturas recorrentes com cartão, Pix e boleto)                       |
| Testes      | Vitest (unit/integração) + Playwright (e2e mobile)                                             |
| Qualidade   | ESLint + Prettier + TypeScript strict + CI (GitHub Actions)                                    |

---

## 3. Arquitetura em camadas

```
FRONTEND (React/Vite/Tailwind, mobile-first, PWA)
  Bottom-nav: Dashboard · Campanhas · Estratégias · CRM · Mais
        ↓ REST/JSON + JWT Supabase
API / ORQUESTRAÇÃO (Node/Express em Vercel Functions)
  Regras de negócio · Permissões (papéis) · Rate limit interno
   ├── INTEGRAÇÕES: Meta API · Google Ads API · CAPI
   ├── IA: Haiku (classif.) · Sonnet (copy/análise/recomendação)
   ├── AUTOMAÇÃO: Vercel Cron + fila (sync, anomalia, workflows lead)
   └── DADOS: Supabase Postgres (RLS) · Storage (criativos)
SEGURANÇA & COMPLIANCE (transversal)
  Cofre de tokens · RLS multi-tenant · Audit log · LGPD
```

**Monorepo sugerido:**

```
/apps/web        → React/Vite/Tailwind (PWA)
/apps/api        → Express (Vercel Functions)
/packages/shared → tipos TS + schemas Zod compartilhados
/supabase        → migrations + policies RLS + seeds (inclui catálogo de estratégias)
/tests           → e2e Playwright
CLAUDE.md        → contrato do agente
```

---

## 4. Modelo de dados (schema)

Toda tabela carrega `agencia_id` (direto ou por join) e usa **RLS**. `token` nunca em texto puro.

**Tenancy & acesso**

- `agencias` (id, nome, plano, status, created_at)
- `usuarios` (id, agencia_id, nome, email, papel[`owner`|`gestor`|`viewer`], auth_supabase_id)
- `clientes` (id, agencia_id, nome, nicho, site, status) — o e-commerce atendido
- `contas_anuncio` (id, cliente_id, plataforma[`meta`|`google`], external_account_id, token_ref→vault, escopo, status)

**Campanhas (espelho sincronizado)**

- `campanhas` (id, conta_anuncio_id, external_id, nome, objetivo, status, budget, budget_tipo)
- `conjuntos` (id, campanha_id, external_id, nome, status, budget, publico) — adsets/adgroups
- `anuncios` (id, conjunto_id, external_id, nome, status, criativo_ref)
- `metricas_diarias` (id, entidade_tipo, entidade_id, data, impressoes, cliques, gasto, conversoes, receita, ctr, cpa, roas)

**CRM & automação**

- `pipelines` (id, cliente_id, nome)
- `estagios` (id, pipeline_id, nome, ordem)
- `leads` (id, cliente_id, estagio_id, nome, contato, origem, valor, status)
- `eventos_lead` (id, lead_id, tipo, payload, created_at)
- `automacoes` (id, cliente_id, nome, gatilho, condicoes[json], acoes[json], ativo)
- `execucoes_automacao` (id, automacao_id, lead_id, resultado, created_at)

**IA & criativos**

- `criativos` (id, cliente_id, tipo[`copy`|`headline`|`imagem`], conteudo, origem[`ia`|`manual`], status)
- `variacoes_criativo` (id, criativo_id, conteudo, metrica_ref)
- `geracoes_ia` (id, cliente_id, modelo[`haiku`|`sonnet`], prompt, resultado, tokens_in, tokens_out, custo, created_at)

**Estratégias (Seção 6)**

- `estrategias` — catálogo global curado (versionado)
- `estrategias_aplicadas` — instância por cliente + status + resultado
- `estrategia_checklist_itens` — o "trabalho padrão" da estratégia aplicada
- `estrategia_versoes` — histórico (melhoria contínua)
  _(colunas detalhadas na Seção 6.3)_

**PDCA / otimização**

- `recomendacoes` (id, cliente_id, tipo, alvo_entidade, descricao, impacto_estimado, status[`sugerida`|`aprovada`|`aplicada`|`rejeitada`], origem[`ia`|`regra`], created_at)
- `anomalias` (id, cliente_id, metrica, valor, esperado, severidade, detectada_em)
- `regras_otimizacao` (id, cliente_id, condicao[json], acao[json], guardrails[json], ativo)

**Segurança / billing**

- `audit_log` (id, agencia_id, usuario_id, acao, entidade, antes[json], depois[json], created_at)
- `assinaturas` (id, agencia_id, plano, status, pagarme_customer_id, pagarme_subscription_id)
- Cofre de tokens: valores criptografados (KMS/secret manager); a tabela guarda só referência.

---

## 5. API — rotas por módulo

- **Auth/Tenancy:** `POST /auth/*` (Supabase), `GET/POST /agencias`, `GET/POST/PATCH /usuarios`, `GET/POST/PATCH /clientes`
- **Conexão:** `GET /oauth/:plataforma/start`, `GET /oauth/:plataforma/callback`, `POST /contas/sync`, `GET /contas`
- **Campanhas:** `GET /clientes/:id/campanhas`, `PATCH /campanhas/:id` (pausar/ativar/budget), `GET /metricas`
- **CRM:** `GET/POST /pipelines`, `GET/POST/PATCH /leads`, `POST /leads/:id/eventos`, `GET/POST/PATCH /automacoes`
- **IA:** `POST /ia/copy`, `POST /ia/headlines`, `POST /ia/analise`, `POST /ia/imagem`
- **Estratégias:** `GET /estrategias`, `GET /estrategias/:id`, `POST /clientes/:id/estrategias/:estrategiaId/aplicar`, `GET /clientes/:id/estrategias-aplicadas`, `PATCH /estrategias-aplicadas/:id`, `PATCH /estrategia-checklist/:id`
- **PDCA:** `GET /clientes/:id/recomendacoes`, `PATCH /recomendacoes/:id`, `GET /clientes/:id/anomalias`, `GET/POST /regras-otimizacao`
- **Billing:** `POST /billing/checkout`, `POST /billing/webhook`, `GET /assinatura`
- **Jobs (Cron):** `POST /cron/sync-metricas`, `POST /cron/detectar-anomalias`, `POST /cron/rodar-automacoes`

Toda rota valida input com Zod, aplica papel do usuário e escreve em `audit_log` quando altera estado externo (budget, status de campanha).

---

## 6. Aba Estratégias — feature de destaque

### 6.1 Conceito

A aba Estratégias é **trabalho padronizado (standard work) aplicado a mídia paga**: uma biblioteca de padrões de tráfego **comprovados e consolidados** que o cliente **analisa, seleciona e inclui** na conta dele. Cada estratégia é uma "folha de padrão" com objetivo, quando usar, impacto esperado em CAC/ROAS, pré-requisitos, passos, guardrails e KPI de sucesso. Ao aplicar, o sistema gera um **checklist executável** e passa a **medir o resultado** — alimentando o motor de PDCA (Seção 7). As estratégias são **versionadas**: o que funciona melhora a versão do padrão (melhoria contínua real).

### 6.2 Jornada no app (mobile-first)

1. **Analisar** — lista de estratégias filtrável por canal, objetivo e nível. Cada card mostra impacto esperado e pré-requisitos.
2. **Detalhe** — folha completa: passos, guardrails, KPI de sucesso, casos de uso.
3. **Incluir** — botão "Aplicar nesta conta" → cria `estrategia_aplicada` + checklist. Onde possível, pré-configura estrutura de campanha; onde não, guia o gestor pelo checklist.
4. **Acompanhar** — status (analisando/aplicada/pausada/concluída) + resultado medido vs. KPI esperado.

### 6.3 Schema das estratégias

- `estrategias` (id, titulo, categoria, canal[`meta`|`google`|`ambos`], objetivo, quando_usar, impacto_cac, impacto_roas, pre_requisitos[json], passos[json], guardrails[json], kpi_sucesso, nivel[`iniciante`|`avancado`], versao, ativo)
- `estrategias_aplicadas` (id, cliente_id, estrategia_id, status, aplicada_em, config[json], resultado[json], notas)
- `estrategia_checklist_itens` (id, estrategia_aplicada_id, descricao, feito, ordem)
- `estrategia_versoes` (id, estrategia_id, versao, mudanca, created_at)

### 6.4 Catálogo semente (inserir via seed) — estratégias e-commerce comprovadas

Conteúdo real pra popular o catálogo. Cada linha vira um registro em `estrategias`.

| Estratégia                                          | Canal  | Objetivo                    | Impacto      | Quando usar                   |
| --------------------------------------------------- | ------ | --------------------------- | ------------ | ----------------------------- |
| Estrutura full-funnel (topo/meio/fundo)             | Ambos  | Escala com eficiência       | ↓CAC ↑ROAS   | Conta sem separação de funil  |
| Advantage+ Shopping (ASC)                           | Meta   | Aquisição e-commerce        | ↑ROAS        | Catálogo pronto, +50 conv/sem |
| Performance Max com feed otimizado                  | Google | Aquisição cross-rede        | ↑ROAS        | Feed Merchant Center saudável |
| Retargeting dinâmico de catálogo (DPA)              | Meta   | Recuperar carrinho/visitas  | ↓CAC         | Pixel + catálogo ativos       |
| Público amplo + criativo-led                        | Meta   | Escala moderna              | ↑ROAS        | Boa esteira de criativos      |
| Lookalike baseado em valor (compradores)            | Meta   | Aquisição qualificada       | ↓CAC         | +100 compradores na base      |
| Exclusão de compradores recentes                    | Ambos  | Cortar desperdício          | ↓CAC         | Sempre (higiene)              |
| Framework de teste de criativo (ângulos/hooks)      | Ambos  | Achar criativo vencedor     | ↑ROAS        | Contínuo                      |
| Server-side tracking (CAPI)                         | Meta   | Recuperar atribuição        | ↑ROAS        | Pós-iOS, mensuração fraca     |
| Defesa de marca + termos não-marca (Search)         | Google | Proteger e capturar demanda | ↓CAC         | Marca com busca própria       |
| CBO / orçamento no nível de campanha                | Meta   | Alocação automática         | ↑ROAS        | +3 conjuntos comparáveis      |
| Regras de escala (subir vencedor / cortar CPA alto) | Ambos  | Disciplina de escala        | ↓CAC ↑ROAS   | Contas em crescimento         |
| Message match anúncio→landing→oferta                | Ambos  | Aumentar conversão          | ↑ROAS        | Landing genérica              |
| Loop pós-compra (upsell + retargeting retenção)     | Ambos  | Aumentar LTV                | ↑faturamento | Base de clientes ativa        |
| Criativo estilo UGC                                 | Meta   | CTR e confiança             | ↑ROAS        | Fadiga de criativo produzido  |

_(O Claude Code deve criar seed idempotente com estes registros na versão 1, cada um com passos e guardrails detalhados.)_

---

## 7. Motor PDCA (o diferencial)

Ciclo de melhoria contínua sobre cada conta, unindo dashboards + IA + automação:

- **Plan** — IA/regra sugere: realocar budget, aplicar estratégia, testar criativo, pausar anúncio acima da meta de CPA — grava em `recomendacoes`.
- **Do** — gestor aprova, ou automação executa dentro dos `guardrails` que ele definiu em `regras_otimizacao`.
- **Check** — `cron/detectar-anomalias` (nightly + LLM) grava `anomalias`; dashboards mostram desvio.
- **Act** — desvio vira nova recomendação; estratégia que performa sobe de `versao`. Ciclo recomeça.

---

## 8. Sequência de construção (sprints)

Ordem obrigatória. Cada sprint fecha com **DoD = código + testes verdes + revisão**.

| Sprint                           | Objetivo          | Entregáveis-chave                                                                                                                                                                                                                                                                | DoD                                                         |
| -------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **0 — Fundação**                 | Base sólida       | Monorepo, CI, TS strict, `CLAUDE.md`, schema+RLS, Auth, papéis, **design system mobile-first** (tokens, bottom-nav shell, PWA), harness Vitest+Playwright. **Iniciar aprovações Meta/Google.**                                                                                   | App instala como PWA, login funciona, RLS testado, CI verde |
| **0.5 — Recuperação & DevOps**   | Ambiente saudável | Migrar repo para `D:\ax-ads` (fora do OneDrive), remover `node_modules_broken_*`, reinstalar deps, corrigir script `typecheck` (usar `tsc -b` sem `--noEmit`), commit inicial, criar repo GitHub + push (token em `.env.local`), aplicar migrations no Supabase, conectar Vercel | `npm run check` verde local **e** no CI do GitHub           |
| **1 — Conexão de contas**        | OAuth + cofre     | Fluxo OAuth Meta, cofre de tokens criptografado, sync de contas/campanhas (leitura)                                                                                                                                                                                              | Conecta conta real, tokens nunca em log, testado            |
| **2 — Dashboard mobile**         | Ver performance   | `cron/sync-metricas`, snapshots diários, painel ROAS/CAC/CPA/CTR por cliente e campanha                                                                                                                                                                                          | Métricas corretas vs. plataforma, mobile fluido             |
| **3 — Ações de campanha**        | Operar            | Pausar/ativar/ajustar budget (Meta) + `audit_log`                                                                                                                                                                                                                                | Ação reflete na plataforma, auditada, testada               |
| **4 — Estratégias**              | Feature destaque  | Catálogo + seed, aplicar, checklist, medição de resultado (Seção 6)                                                                                                                                                                                                              | Aplicar gera checklist e mede KPI, e2e passa                |
| **5 — CRM + automação**          | Jornada de lead   | Pipeline kanban, leads, automações (básica→avançada)                                                                                                                                                                                                                             | Lead entra→automação dispara, testado                       |
| **6 — Studio criativo IA**       | Copy/headlines    | Geração Sonnet, classificação Haiku, log de custo                                                                                                                                                                                                                                | Gera variações, custo registrado, testado                   |
| **7 — Google Ads**               | 2º canal          | Integração Google Ads (após token aprovado), PMax/Shopping                                                                                                                                                                                                                       | Paridade com Meta no dashboard/ações                        |
| **8 — Tracking server-side**     | Atribuição        | Conversions API / server-side tagging                                                                                                                                                                                                                                            | Eventos chegam, atribuição melhora                          |
| **9 — Motor PDCA**               | Inteligência      | Anomalias (cron+LLM), recomendações, regras/guardrails, otimização assistida                                                                                                                                                                                                     | Recomendação real gerada e aplicável                        |
| **10 — Criativos visuais IA**    | Imagem            | Geração de imagem + variações                                                                                                                                                                                                                                                    | Assets gerados e usáveis em anúncio                         |
| **11 — Billing & onboarding**    | Vender sozinho    | Pagar.me (assinaturas v5: cartão/Pix/boleto), planos, webhooks de cobrança, onboarding self-service                                                                                                                                                                              | Assinar e usar sem intervenção manual                       |
| **12 — White-label & hardening** | Escala + polish   | White-label agência, admin, LGPD, perf/PWA, pen-test básico                                                                                                                                                                                                                      | Marca do cliente, checklist de segurança OK                 |

---

## 9. Segurança da informação (não-negociável)

- **Cofre de tokens:** OAuth criptografado em repouso (KMS/secret manager); nunca no front; nunca em log.
- **RLS multi-tenant:** política por `agencia_id` em toda tabela; testar isolamento com usuário de outro tenant.
- **Menor privilégio:** papéis `owner`/`gestor`/`viewer` com escopo mínimo.
- **Audit log:** toda alteração de budget/status registrada (também é rastreabilidade de qualidade).
- **LGPD:** base legal + consentimento p/ PII de compradores; DPA com clientes (você é operador); retenção/exclusão.
- **Segredos:** `.env` fora do git; secrets no Vercel/Supabase.
- _Fora de escopo:_ segurança do trabalho (NR) e meio ambiente não se aplicam a este produto.

---

## 10. Testes & qualidade (seu DNA)

- **Unit (Vitest):** lógica de negócio — cálculo de métricas, regras de otimização, aplicação de estratégia, guardrails.
- **Integração:** rotas API + Supabase + RLS.
- **E2E (Playwright):** fluxos mobile críticos (login, conectar conta, aplicar estratégia, aprovar recomendação).
- **Cobertura-alvo:** ≥80% na lógica de negócio crítica.
- **Porta de qualidade:** CI bloqueia merge se lint/tipos/testes falharem.

---

## 11. Mobile-first (regra de design)

- Estilo **base = mobile**; usar `md:`/`lg:` só para ampliar (nunca o contrário).
- **Bottom navigation:** Dashboard · Campanhas · **Estratégias** · CRM · Mais.
- Alvos de toque ≥44px; ações principais na zona do polegar.
- **PWA** instalável (gestor opera do celular); offline leve para leitura de dashboard.
- **Orçamento de performance:** LCP baixo, bundle enxuto, lazy-load por rota, imagens otimizadas.

---

## 12. Pré-requisitos externos (iniciar no Sprint 0, rodam em paralelo)

- Meta for Developers: criar App tipo Business + Marketing API. **Para testes:** app em _Development Mode_ + **Sandbox Ad Account** (não precisa App Review). **Para produção:** Business Verification + App Review de `ads_management` (semanas — iniciar cedo).
- Google Ads: criar MCC + solicitar **developer token** no API Center (nasce com _test account access_ — suficiente p/ dev com **contas de teste**). Projeto no Google Cloud com OAuth consent + credenciais. **Para produção:** aplicar para Basic → Standard access.
- Pagar.me: criar conta (KYC: CNPJ + dados bancários), ativar modo de teste (chaves `sk_test`/`pk_test`), definir planos de assinatura e configurar webhooks.
- Supabase + Vercel + GitHub: **tokens já disponíveis em `.env.local`** — provisionar projeto, aplicar migrations e conectar deploy (Sprint 0.5).

---

_Próximo artefato sob demanda: o SQL das migrations + policies RLS do Sprint 0, prontos pra rodar._
