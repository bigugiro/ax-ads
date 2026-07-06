# BRAND.md — Dispara

### Identidade de marca do SaaS de tráfego pago + automação + IA (vertical e-commerce)

**Para o Claude Code:** esta é a fonte de verdade da marca. Todo componente de UI deve consumir os tokens da Seção 6 (nunca hex solto). Mobile-first sempre.

---

## 1. Essência

| Item                 | Definição                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------- |
| Nome                 | **Dispara**                                                                                             |
| Tagline              | Bota pra rodar, o faturamento dispara                                                                   |
| Promessa             | Campanha no automático, IA no trabalho pesado, venda subindo                                            |
| Posicionamento       | Ferramenta de tráfego pago pra gestor/agência que atende e-commerce e quer **resultado sem tecnicismo** |
| Personalidade        | Enérgico · Brasileiro · Direto                                                                          |
| Arquitetura de marca | **Dispara** (voltada ao gestor) _powered by AX_ (assinatura institucional discreta)                     |

**O que a marca sempre defende:** ↓ CAC e ↑ faturamento. Se um recurso ou tela não comunica um dos dois, revisar.

---

## 2. Tom de voz

Brasileiro, próximo e direto — como um sócio que manja de tráfego falando com você, sem jargão vazio.

- **Fala assim:** "Bora escalar", "Campanha no ar", "Seu ROAS subiu 18%", "Cortei o que tava queimando verba".
- **Não fala:** "Otimização sinérgica de performance", "solução robusta e escalável", corporativês.
- **Regras:** frase curta, voz ativa, verbo na frente. Sentence case sempre (nada de CAIXA ALTA gritando). Sem `!` em UI de sistema. Número sempre redondo na tela.
- **Microcopy exemplo:** botão `Conectar conta` · vazio `Nenhuma campanha ainda. Bora criar a primeira?` · sucesso `Conta conectada` · erro `Não rolou conectar. Tenta de novo.`

---

## 3. Paleta

| Papel       | Nome            | Hex       | Uso                              |
| ----------- | --------------- | --------- | -------------------------------- |
| Primária    | Laranja disparo | `#FF6A2C` | Ação principal, marca, CTA       |
| Secundária  | Roxo elétrico   | `#6B3FE4` | Destaques, dados, gráficos       |
| Fundo claro | Creme           | `#FFF4EC` | Superfície quente (modo claro)   |
| Tinta       | Grafite quente  | `#241A16` | Texto forte, fundo (modo escuro) |
| Sucesso     | Verde subiu     | `#19A974` | ROAS positivo, meta batida       |
| Alerta      | Âmbar atenção   | `#F4A930` | Anomalia, CPA acima da meta      |
| Erro        | Vermelho corta  | `#E24B4A` | Queda, falha, verba queimando    |

**Regras de cor**

- Laranja é da ação — usar com parcimônia (1 CTA primário por tela). Espalhar demais mata o significado.
- Roxo nunca compete com laranja no mesmo bloco; roxo é dado/apoio.
- Texto sobre laranja/roxo usa branco ou creme — nunca preto puro.
- Verde/âmbar/vermelho carregam sentido (subiu/atenção/caiu). Não usar como enfeite.

---

## 4. Tipografia

| Papel   | Fonte              | Peso      | Uso                              |
| ------- | ------------------ | --------- | -------------------------------- |
| Display | **Baloo 2**        | 600 / 800 | Wordmark, títulos, números-herói |
| Texto   | **Inter**          | 400 / 500 | Corpo, labels, UI                |
| Mono    | **JetBrains Mono** | 400       | IDs, hex, valores técnicos       |

- Só dois pesos por contexto. Nunca 700 em corpo de texto de UI.
- Escala mobile: título 22px · subtítulo 18px · seção 16px · corpo 16px · label 13px · caption 11px (mínimo).
- Import: `Baloo 2` e `Inter` via Google Fonts; `JetBrains Mono` para técnico.

---

## 5. Logo & símbolo

- **Wordmark:** "Dispara" em Baloo 2 800, laranja `#FF6A2C` sobre claro / creme sobre escuro.
- **Símbolo:** foguete ou seta-disparo ascendente (ícone Tabler `ti-rocket` como base de UI).
- **Assinatura institucional:** "powered by AX" em Inter 500, `--text-muted`, discreta no rodapé/onboarding.
- **Área de respiro:** manter margem = altura do "D" ao redor do wordmark.
- **Não fazer:** distorcer, aplicar sombra/gradiente, trocar as cores, usar laranja sobre fundo laranja.

---

## 6. Design tokens (consumir na UI — não usar hex solto)

Implementados em `apps/web/src/index.css` como **canais RGB** (`R G B`), para o Tailwind aplicar opacidade por utilitário (`bg-brand/70`, `ring-brand/30`). O Tailwind (`tailwind.config.ts`) mapeia cada papel para `rgb(var(--token) / <alpha-value>)`. Suporte a modo claro/escuro obrigatório (`prefers-color-scheme` + override `[data-theme]`).

Referência de origem (hex da Seção 3), convertida para canais no CSS:

```
--dispara-orange: #FF6A2C  → 255 106 44
--dispara-orange-strong: #E4551B → 228 85 27
--dispara-purple: #6B3FE4  → 107 63 228
--dispara-cream:  #FFF4EC  → 255 244 236
--dispara-ink:    #241A16  → 36 26 22
--color-success:  #19A974  → 25 169 116
--color-warning:  #F4A930  → 244 169 48
--color-danger:   #E24B4A  → 226 75 74
```

**Tailwind:** classes utilitárias saem da marca (`bg-brand`, `text-accent`, `border-line`, `font-display`, etc.). Fonte base do `web`: Inter; `font-display` = Baloo 2.

---

## 7. Aplicação na UI (mobile-first)

- **Bottom-nav:** Dashboard · Campanhas · **Estratégias** · CRM · Mais. Item ativo em laranja; inativos em `--text-muted`.
- **CTA primário:** fundo laranja, texto branco, `--radius`, alvo ≥44px. Um por tela.
- **Cards:** `--surface-1`, borda `--border`, `--radius-card`, respiro generoso.
- **Números-herói** (ROAS, faturamento): Baloo 2, grande, laranja quando positivo/CTA, verde quando meta batida.
- **Aba Estratégias:** cada card usa a cor de status pra sinalizar impacto esperado (verde ↑ROAS, âmbar ↓CAC/atenção). Botão "Aplicar" = CTA laranja.
- **Estados:** loading enxuto; vazio com microcopy da marca ("Bora criar a primeira?"); erro direto e sem drama.
- **PWA:** ícone com símbolo-foguete sobre laranja; splash creme/laranja; theme-color `#FF6A2C`.

---

## 8. Checklist de marca (DoD visual)

- [ ] Só tokens da Seção 6 — nenhum hex solto no componente
- [ ] 1 CTA primário laranja por tela
- [ ] Contraste OK em claro e escuro (texto sobre laranja = branco/creme)
- [ ] Sentence case em toda label; número redondo na tela
- [ ] Microcopy no tom Dispara (curto, brasileiro, direto)
- [ ] Alvos de toque ≥44px, mobile primeiro
- [ ] Assinatura "powered by AX" presente e discreta
