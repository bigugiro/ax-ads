/**
 * Rotas de CRM + automação (Sprint 5, Seção 5 do plano) — pipeline kanban,
 * leads, linha do tempo e automações. Leitura liberada a qualquer papel;
 * escrita exige `gerenciar_crm` (gestor+).
 */
import {
  atualizarAutomacaoSchema,
  atualizarLeadSchema,
  criarAutomacaoSchema,
  criarEventoLeadSchema,
  criarLeadSchema,
  criarPipelineSchema,
  listarAutomacoesQuerySchema,
  listarLeadsQuerySchema,
  listarPipelinesQuerySchema,
  uuidSchema,
} from '@ax-ads/shared';
import type {
  AtualizarAutomacao,
  AtualizarLead,
  CriarAutomacao,
  CriarEventoLead,
  CriarLead,
  CriarPipeline,
} from '@ax-ads/shared';
import { Router } from 'express';
import { getAuth } from '../lib/auth-context';
import { asyncHandler, HttpError } from '../lib/http';
import { authenticate } from '../middleware/auth';
import { requireAcao } from '../middleware/require-role';
import { validateBody, validateParam } from '../middleware/validate';
import {
  atualizarAutomacao,
  atualizarLead,
  criarAutomacao,
  criarEventoLead,
  criarLead,
  criarPipeline,
  listarAutomacoes,
  listarEventosLead,
  listarLeads,
  listarPipelines,
} from '../services/crm';

export const crmRouter: Router = Router();

crmRouter.use(authenticate);

// ----- Pipelines -----

crmRouter.get(
  '/pipelines',
  asyncHandler(async (req, res) => {
    const query = listarPipelinesQuerySchema.safeParse(req.query);
    if (!query.success) throw new HttpError(422, 'Query inválida', query.error.flatten());
    const { db } = getAuth(req);
    const data = await listarPipelines(db, query.data);
    res.json({ data });
  }),
);

crmRouter.post(
  '/pipelines',
  requireAcao('gerenciar_crm'),
  validateBody(criarPipelineSchema),
  asyncHandler(async (req, res) => {
    const { db, agenciaId } = getAuth(req);
    const payload = req.body as CriarPipeline;
    const data = await criarPipeline(db, { agenciaId, payload });
    res.status(201).json({ data });
  }),
);

// ----- Leads -----

crmRouter.get(
  '/leads',
  asyncHandler(async (req, res) => {
    const query = listarLeadsQuerySchema.safeParse(req.query);
    if (!query.success) throw new HttpError(422, 'Query inválida', query.error.flatten());
    const { db } = getAuth(req);
    const data = await listarLeads(db, query.data);
    res.json({ data });
  }),
);

crmRouter.post(
  '/leads',
  requireAcao('gerenciar_crm'),
  validateBody(criarLeadSchema),
  asyncHandler(async (req, res) => {
    const { db, agenciaId } = getAuth(req);
    const payload = req.body as CriarLead;
    const data = await criarLead(db, { agenciaId, payload });
    res.status(201).json({ data });
  }),
);

crmRouter.patch(
  '/leads/:id',
  requireAcao('gerenciar_crm'),
  validateParam('id', uuidSchema),
  validateBody(atualizarLeadSchema),
  asyncHandler(async (req, res) => {
    const { db, agenciaId } = getAuth(req);
    const id = uuidSchema.parse(req.params.id);
    const patch = req.body as AtualizarLead;
    const data = await atualizarLead(db, { agenciaId, id, patch });
    res.json({ data });
  }),
);

// ----- Linha do tempo do lead -----

crmRouter.get(
  '/leads/:id/eventos',
  validateParam('id', uuidSchema),
  asyncHandler(async (req, res) => {
    const { db } = getAuth(req);
    const data = await listarEventosLead(db, uuidSchema.parse(req.params.id));
    res.json({ data });
  }),
);

crmRouter.post(
  '/leads/:id/eventos',
  requireAcao('gerenciar_crm'),
  validateParam('id', uuidSchema),
  validateBody(criarEventoLeadSchema),
  asyncHandler(async (req, res) => {
    const { db, agenciaId } = getAuth(req);
    const leadId = uuidSchema.parse(req.params.id);
    const payload = req.body as CriarEventoLead;
    await criarEventoLead(db, {
      agenciaId,
      leadId,
      tipo: payload.tipo,
      ...(payload.payload !== undefined ? { payload: payload.payload } : {}),
    });
    res.status(201).json({ data: { ok: true } });
  }),
);

// ----- Automações -----

crmRouter.get(
  '/automacoes',
  asyncHandler(async (req, res) => {
    const query = listarAutomacoesQuerySchema.safeParse(req.query);
    if (!query.success) throw new HttpError(422, 'Query inválida', query.error.flatten());
    const { db } = getAuth(req);
    const data = await listarAutomacoes(db, query.data);
    res.json({ data });
  }),
);

crmRouter.post(
  '/automacoes',
  requireAcao('gerenciar_crm'),
  validateBody(criarAutomacaoSchema),
  asyncHandler(async (req, res) => {
    const { db, agenciaId } = getAuth(req);
    const payload = req.body as CriarAutomacao;
    const data = await criarAutomacao(db, { agenciaId, payload });
    res.status(201).json({ data });
  }),
);

crmRouter.patch(
  '/automacoes/:id',
  requireAcao('gerenciar_crm'),
  validateParam('id', uuidSchema),
  validateBody(atualizarAutomacaoSchema),
  asyncHandler(async (req, res) => {
    const { db } = getAuth(req);
    const id = uuidSchema.parse(req.params.id);
    const patch = req.body as AtualizarAutomacao;
    const data = await atualizarAutomacao(db, id, patch);
    res.json({ data });
  }),
);
