/**
 * Papéis de usuário e controle de acesso (menor privilégio).
 * Regra do CLAUDE.md: toda rota checa o papel (`owner` | `gestor` | `viewer`).
 *
 * Hierarquia de privilégio (maior número = mais poder):
 *   viewer (1)  →  gestor (2)  →  owner (3)
 */

export const PAPEIS = ['owner', 'gestor', 'viewer'] as const;
export type Papel = (typeof PAPEIS)[number];

/** Nível numérico de privilégio por papel. */
const NIVEL_PRIVILEGIO: Record<Papel, number> = {
  viewer: 1,
  gestor: 2,
  owner: 3,
};

/** `true` se `papel` tem privilégio ≥ ao papel mínimo exigido. */
export function temNivelMinimo(papel: Papel, minimo: Papel): boolean {
  return NIVEL_PRIVILEGIO[papel] >= NIVEL_PRIVILEGIO[minimo];
}

/**
 * Ações sensíveis do produto e o papel mínimo que pode executá-las.
 * Mantém o mapa em um único lugar para auditar permissões facilmente.
 */
export const ACOES = [
  'ver_dashboard',
  'gerenciar_clientes',
  'conectar_conta', // conectar/sincronizar/desconectar conta de anúncio
  'operar_campanha', // pausar/ativar/ajustar budget
  'aplicar_estrategia',
  'gerenciar_crm', // pipelines/estágios/leads/eventos/automações (Sprint 5)
  'gerenciar_criativos', // studio criativo IA: gerar copy/headlines, analisar (Sprint 6)
  'aprovar_recomendacao',
  'gerenciar_usuarios',
  'gerenciar_billing',
  'gerenciar_agencia', // marca (white-label) e exclusão de conta (LGPD) — Sprint 10
] as const;
export type Acao = (typeof ACOES)[number];

/** Papel mínimo exigido por ação. */
const PAPEL_MINIMO_POR_ACAO: Record<Acao, Papel> = {
  ver_dashboard: 'viewer',
  gerenciar_clientes: 'gestor',
  conectar_conta: 'gestor',
  operar_campanha: 'gestor',
  aplicar_estrategia: 'gestor',
  gerenciar_crm: 'gestor',
  gerenciar_criativos: 'gestor',
  aprovar_recomendacao: 'gestor',
  gerenciar_usuarios: 'owner',
  gerenciar_billing: 'owner',
  gerenciar_agencia: 'owner',
};

/** `true` se o papel pode executar a ação. */
export function podeExecutar(papel: Papel, acao: Acao): boolean {
  return temNivelMinimo(papel, PAPEL_MINIMO_POR_ACAO[acao]);
}

/** Type guard: valida se um valor desconhecido é um `Papel`. */
export function ehPapel(valor: unknown): valor is Papel {
  return typeof valor === 'string' && (PAPEIS as readonly string[]).includes(valor);
}
