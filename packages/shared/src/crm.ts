/**
 * Domínio de CRM + automação (Sprint 5, Seção 5 do plano): pipeline kanban,
 * leads, linha do tempo e o motor de regras de automação.
 *
 * `condicoesBatem` é o núcleo PURO do motor (sem IO) — testável isoladamente.
 * A orquestração (carregar automações ativas, executar ações no banco,
 * registrar `execucoes_automacao`) fica no serviço da API.
 */
import { z } from 'zod';
import { uuidSchema } from './schemas';

// ----- Enums (espelham os types do Postgres em 0009_crm_schema.sql) -----
export const statusLeadSchema = z.enum(['aberto', 'ganho', 'perdido']);
export const gatilhoAutomacaoSchema = z.enum(['lead_criado', 'lead_mudou_estagio']);

export type StatusLead = z.infer<typeof statusLeadSchema>;
export type GatilhoAutomacao = z.infer<typeof gatilhoAutomacaoSchema>;

const nomeCurtoSchema = z.string().trim().min(1).max(120);
const contatoSchema = z.string().trim().min(1).max(160);

// ----- pipelines / estagios -----
export const pipelineSchema = z.object({
  id: uuidSchema,
  agencia_id: uuidSchema,
  cliente_id: uuidSchema,
  nome: nomeCurtoSchema,
  created_at: z.string(),
});
export type Pipeline = z.infer<typeof pipelineSchema>;

export const estagioSchema = z.object({
  id: uuidSchema,
  agencia_id: uuidSchema,
  pipeline_id: uuidSchema,
  nome: z.string().trim().min(1).max(80),
  ordem: z.number().int(),
  created_at: z.string(),
});
export type Estagio = z.infer<typeof estagioSchema>;

/** Estágios padrão de um funil de vendas de e-commerce (seed ao criar pipeline). */
export const ESTAGIOS_PADRAO = ['Novo', 'Contatado', 'Qualificado', 'Proposta', 'Ganho', 'Perdido'];

/** Payload de `POST /pipelines`. Sem `estagios`, usa `ESTAGIOS_PADRAO`. */
export const criarPipelineSchema = z.object({
  cliente_id: uuidSchema,
  nome: nomeCurtoSchema,
  estagios: z.array(z.string().trim().min(1).max(80)).min(1).optional(),
});
export type CriarPipeline = z.infer<typeof criarPipelineSchema>;

/** Query de `GET /pipelines` — filtro por cliente. */
export const listarPipelinesQuerySchema = z.object({ cliente_id: uuidSchema.optional() });
export type ListarPipelinesQuery = z.infer<typeof listarPipelinesQuerySchema>;

// ----- leads -----
export const leadSchema = z.object({
  id: uuidSchema,
  agencia_id: uuidSchema,
  cliente_id: uuidSchema,
  estagio_id: uuidSchema,
  nome: nomeCurtoSchema,
  contato: contatoSchema,
  origem: z.string().trim().min(1).max(60),
  valor: z.number().nonnegative().nullable(),
  status: statusLeadSchema,
  created_at: z.string(),
});
export type Lead = z.infer<typeof leadSchema>;

/** Payload de `POST /leads` — dispara automações de `lead_criado`. */
export const criarLeadSchema = z.object({
  cliente_id: uuidSchema,
  estagio_id: uuidSchema,
  nome: nomeCurtoSchema,
  contato: contatoSchema,
  origem: z.string().trim().min(1).max(60).default('manual'),
  valor: z.number().nonnegative().nullable().optional(),
});
export type CriarLead = z.infer<typeof criarLeadSchema>;

/** Payload de `PATCH /leads/:id` — mudar `estagio_id` dispara `lead_mudou_estagio`. */
export const atualizarLeadSchema = z
  .object({
    estagio_id: uuidSchema.optional(),
    nome: nomeCurtoSchema.optional(),
    contato: contatoSchema.optional(),
    valor: z.number().nonnegative().nullable().optional(),
    status: statusLeadSchema.optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: 'Informe ao menos um campo para atualizar',
  });
export type AtualizarLead = z.infer<typeof atualizarLeadSchema>;

/** Query de `GET /leads` — filtro por pipeline (via estágios) ou cliente. */
export const listarLeadsQuerySchema = z.object({
  pipeline_id: uuidSchema.optional(),
  cliente_id: uuidSchema.optional(),
});
export type ListarLeadsQuery = z.infer<typeof listarLeadsQuerySchema>;

// ----- eventos_lead (linha do tempo) -----
export const eventoLeadSchema = z.object({
  id: uuidSchema,
  agencia_id: uuidSchema,
  lead_id: uuidSchema,
  tipo: z.string().min(1).max(60),
  payload: z.unknown(),
  created_at: z.string(),
});
export type EventoLead = z.infer<typeof eventoLeadSchema>;

/** Payload de `POST /leads/:id/eventos` — anotação manual na linha do tempo. */
export const criarEventoLeadSchema = z.object({
  tipo: z.string().trim().min(1).max(60),
  payload: z.record(z.string(), z.unknown()).optional(),
});
export type CriarEventoLead = z.infer<typeof criarEventoLeadSchema>;

// ----- automacoes (motor de regras) -----

/** Condição de disparo: TODAS as chaves presentes precisam bater; vazio = sempre dispara. */
export const condicoesAutomacaoSchema = z
  .object({
    /** Só dispara se o lead tiver essa `origem` exata (ex.: "meta_ads"). */
    origem: z.string().trim().min(1).optional(),
    /** Só dispara (gatilho `lead_mudou_estagio`) se o lead entrou nesse estágio. */
    estagio_nome: z.string().trim().min(1).optional(),
  })
  .strict();
export type CondicoesAutomacao = z.infer<typeof condicoesAutomacaoSchema>;

/** Uma ação executável, em ordem, quando a automação dispara. */
export const acaoAutomacaoSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('mudar_estagio'), estagio_nome: z.string().trim().min(1) }),
  z.object({ tipo: z.literal('definir_status'), status: statusLeadSchema }),
  z.object({ tipo: z.literal('criar_evento'), descricao: z.string().trim().min(1).max(500) }),
]);
export type AcaoAutomacao = z.infer<typeof acaoAutomacaoSchema>;

export const automacaoSchema = z.object({
  id: uuidSchema,
  agencia_id: uuidSchema,
  cliente_id: uuidSchema,
  nome: nomeCurtoSchema,
  gatilho: gatilhoAutomacaoSchema,
  condicoes: condicoesAutomacaoSchema,
  acoes: z.array(acaoAutomacaoSchema),
  ativo: z.boolean(),
  created_at: z.string(),
});
export type Automacao = z.infer<typeof automacaoSchema>;

/** Payload de `POST /automacoes`. */
export const criarAutomacaoSchema = z.object({
  cliente_id: uuidSchema,
  nome: nomeCurtoSchema,
  gatilho: gatilhoAutomacaoSchema,
  condicoes: condicoesAutomacaoSchema.default({}),
  acoes: z.array(acaoAutomacaoSchema).min(1),
});
export type CriarAutomacao = z.infer<typeof criarAutomacaoSchema>;

/** Payload de `PATCH /automacoes/:id` — gatilho é imutável após criada. */
export const atualizarAutomacaoSchema = z
  .object({
    nome: nomeCurtoSchema.optional(),
    condicoes: condicoesAutomacaoSchema.optional(),
    acoes: z.array(acaoAutomacaoSchema).min(1).optional(),
    ativo: z.boolean().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: 'Informe ao menos um campo para atualizar',
  });
export type AtualizarAutomacao = z.infer<typeof atualizarAutomacaoSchema>;

/** Query de `GET /automacoes` — filtro por cliente. */
export const listarAutomacoesQuerySchema = z.object({ cliente_id: uuidSchema.optional() });
export type ListarAutomacoesQuery = z.infer<typeof listarAutomacoesQuerySchema>;

// ----- execucoes_automacao -----
export interface ResultadoExecucaoAutomacao {
  acoesExecutadas: AcaoAutomacao['tipo'][];
  erro?: string;
}

export const execucaoAutomacaoSchema = z.object({
  id: uuidSchema,
  agencia_id: uuidSchema,
  automacao_id: uuidSchema,
  lead_id: uuidSchema,
  resultado: z.unknown(),
  created_at: z.string(),
});
export type ExecucaoAutomacao = z.infer<typeof execucaoAutomacaoSchema>;

// ----- Motor de regras (PURO — sem IO, testável isoladamente) -----

/** Contexto do evento que pode ter disparado uma automação. */
export interface ContextoGatilho {
  origem: string;
  /** Nome do estágio de destino (relevante só para `lead_mudou_estagio`). */
  estagioNome?: string;
}

/**
 * `true` se TODAS as condições declaradas baterem com o contexto do evento.
 * Condição ausente no objeto = não restringe (automação sem condições dispara sempre).
 */
export function condicoesBatem(condicoes: CondicoesAutomacao, contexto: ContextoGatilho): boolean {
  if (condicoes.origem !== undefined && condicoes.origem !== contexto.origem) return false;
  if (condicoes.estagio_nome !== undefined && condicoes.estagio_nome !== contexto.estagioNome) {
    return false;
  }
  return true;
}

// ----- Modelos de leitura enriquecidos (respostas da API, não payload) -----

export interface PipelineComEstagios extends Pipeline {
  estagios: Estagio[];
}

export interface LeadComEstagio extends Lead {
  estagio_nome: string;
}
