# Checklist de segurança — Dispara (AX Ads)

Levantamento feito no Sprint 10 (pen-test básico, Seção 8 do plano). Cobre o que já está em produção pelos Sprints 0–10; não é um pentest de terceiros — é a auto-revisão exigida pelo DoD ("checklist de segurança OK").

## Multi-tenancy / RLS

- [x] Toda tabela de dado de tenant nasce com `agencia_id` + `enable/force row level security` (migrations 0001–0019).
- [x] Isolamento entre agências testado em TODA sprint que criou tabela nova (testes de integração `tenant B não enxerga X de A`) — não é uma alegação, é comprovado a cada sprint.
- [x] Escrita sensível (`audit_log`, `assinaturas`, exclusão de conta, admin) é exclusiva da **service role**, nunca do JWT do usuário — e a service role só é lida a partir de `getServiceClient()`, nunca exposta ao front.
- [x] Funções `app.*` (RLS helpers) são `SECURITY DEFINER` só pro necessário (ler `usuarios` sem recursão), documentado em `0001_init_tenancy.sql`.

## Autenticação e papéis

- [x] Toda rota exige `authenticate` (JWT Supabase) exceto as explicitamente públicas: `POST /auth/signup`, `POST /billing/webhook`, `POST /cron/*` — todas com sua própria autorização (ver abaixo).
- [x] Toda ação sensível checa papel mínimo via `requireAcao` (mapa único em `packages/shared/src/roles.ts`) — auditável num só lugar.

> **Bug real pego nesta sprint (não em teste unitário — no gate de integração):** montar `adminRouter` com `app.use(adminRouter)` **sem prefixo de path**, tendo `adminRouter.use(authenticate, requireSuperAdmin)` no nível do router, fazia o Express rodar esse gate pra **toda requisição do app** que chegasse até aquele ponto da cadeia de middlewares — não só pra `/admin/*`. Resultado: 44 testes de outras sprints (Studio IA, Imagem, etc.) passaram a devolver 403 pra usuários legítimos. `router.use(middleware)` sem path roda pra qualquer request que atravesse o router, incluindo requests que não vão bater em nenhuma rota definida nele — a regra agora é: **todo router com um gate "hard" (`requireSuperAdmin`, ou qualquer coisa que barra por padrão) precisa ser montado com prefixo de path** (`app.use('/admin', adminRouter)`), nunca solto na raiz. `agenciasRouter` (só `authenticate`, sem gate duro) recebeu o mesmo tratamento por consistência/defesa em profundidade, já que só `authenticate` sozinho não rejeita ninguém com JWT válido — mas ainda assim rodaria redundantemente pra rotas como `/cron/*`, que nem usam JWT.
- [x] `super_admin` (Sprint 10) nunca é setável via API — só SQL direto pelo operador; rotas `/admin/*` atrás de `requireSuperAdmin`, cross-tenant por design e claramente documentado como exceção à regra de RLS.

## Segredos

- [x] `.env`/`.env.local` fora do git (`.gitignore`).
- [x] Nenhum segredo (chave Supabase, Anthropic, CRON_SECRET, PAGARME_WEBHOOK_AUTH) é logado — grep manual em `console.log`/`console.error` do repo não encontra nenhum valor de env interpolado.
- [x] Comparação de segredos (`CRON_SECRET`, `PAGARME_WEBHOOK_AUTH`) em **tempo constante** (`timingSafeEqual`) — evita timing attack.
- [x] Jobs sem JWT de usuário (cron, webhook) são **fail-closed**: sem o segredo configurado, respondem 503 em vez de rodar sem autorização.

## Rede / transporte

- [x] `helmet()` aplicado globalmente (cabeçalhos de segurança padrão).
- [x] CORS restrito a `CORS_ORIGINS` configurado (não é `*`).
- [x] Rate limit em memória (Sprint 10) nas rotas públicas mais sensíveis a abuso: `POST /auth/signup` (5/min por IP) e `POST /billing/webhook` (30/min por IP). **Limitação conhecida:** é por-processo, não distribuído — suficiente pro estágio atual (single instance); reavaliar se/quando escalar horizontalmente (Redis-backed, ex.: Sprint 11+).

## Validação de input

- [x] Toda rota valida `body`/`params`/`query` com Zod (`validateBody`/`validateParam`) — CLAUDE.md §7.
- [x] `agenciaId` em toda escrita **sempre vem do contexto autenticado** (JWT → `usuarios.agencia_id`), nunca do payload — impede um usuário escrever em outra agência mesmo que tente forjar o campo.

## Dependências

- [x] `npm audit` (produção): **0 vulnerabilidades**.
- [ ] `npm audit` (dev): 6 vulnerabilidades (3 moderate/1 high/2 critical) — todas em `esbuild`/`vite`/`vitest`, servidor de **dev** apenas (não roda em produção). Fix disponível só via upgrade major do Vitest (`vitest@4`), breaking change não aplicado nesta sprint pra não arriscar a suíte de testes sem orçamento de regressão dedicado. **Ação de acompanhamento:** planejar upgrade do Vitest 2→4 numa sprint futura, fora do caminho crítico.

## LGPD

- [x] Consentimento explícito e obrigatório no signup (`aceite_termos`, `z.literal(true)`) — vira parte do registro de auditoria do signup (não é só um checkbox decorativo).
- [x] Direito ao esquecimento: `DELETE /agencias/me` (owner) apaga a agência (cascata: clientes, campanhas, leads, criativos, assinatura, audit_log, tudo) e os usuários correspondentes no Supabase Auth. Irreversível, documentado no código.
- [ ] DPA formal com clientes e política de retenção detalhada por tipo de dado — fora do escopo de código desta sprint (é documento jurídico, não feature).

## O que fica pra depois (documentado, não esquecido)

- Cofre de tokens OAuth criptografado (KMS) — só entra de fato no Sprint 11 (Meta), quando existirem tokens reais pra guardar.
- White-label: só nome/cor/logo (Sprint 10). Domínio customizado fica pra quando houver demanda real de um cliente.
- Rate limit distribuído (Redis) se/quando escalar horizontalmente.
