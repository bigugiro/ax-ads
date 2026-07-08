/**
 * Rotas do motor PDCA (Sprint 7, Seção 7 do plano) — leitura de anomalias/
 * recomendações, aprovar/aplicar/rejeitar recomendação e regras de otimização.
 * Mudar status de recomendação (aprovar/aplicar/rejeitar) exige gestor+
 * (`aprovar_recomendacao`); aplicar de fato audita via `operarCampanha`.
 */
import {
  atualizarRecomendacaoSchema,
  atualizarRegraOtimizacaoSchema,
  criarRegraOtimizacaoSchema,
  listarRecomendacoesQuerySchema,
  listarRegrasQuerySchema,
  uuidSchema,
} from '@ax-ads/shared';
import type { AtualizarRecomendacao, AtualizarRegraOtimizacao, CriarRegraOtimizacao } from '@ax-ads/shared';
import { Router } from 'express';
import { getAuth } from '../lib/auth-context';
import { asyncHandler, HttpError } from '../lib/http';
import { authenticate } from '../middleware/auth';
import { requireAcao } from '../middleware/require-role';
import { validateBody, validateParam } from '../middleware/validate';
import {
  atualizarRecomendacao,
  atualizarRegra,
  criarRegra,
  listarAnomalias,
  listarRecomendacoes,
  listarRegras,
} from '../services/pdca';

export const pdcaRouter: Router = Router();

pdcaRouter.use(authenticate);

// Anomalias detectadas (qualquer papel; RLS filtra por agência).
pdcaRouter.get(
  '/clientes/:clienteId/anomalias',
  validateParam('clienteId', uuidSchema),
  asyncHandler(async (req, res) => {
    const { db } = getAuth(req);
    const data = await listarAnomalias(db, uuidSchema.parse(req.params.clienteId));
    res.json({ data });
  }),
);

// Recomendações do cliente, com filtro opcional por status.
pdcaRouter.get(
  '/clientes/:clienteId/recomendacoes',
  validateParam('clienteId', uuidSchema),
  asyncHandler(async (req, res) => {
    const query = listarRecomendacoesQuerySchema.safeParse(req.query);
    if (!query.success) throw new HttpError(422, 'Query inválida', query.error.flatten());
    const { db } = getAuth(req);
    const data = await listarRecomendacoes(db, uuidSchema.parse(req.params.clienteId), query.data);
    res.json({ data });
  }),
);

// Aprovar/aplicar/rejeitar recomendação (gestor+); "aplicada" executa de verdade.
pdcaRouter.patch(
  '/recomendacoes/:id',
  requireAcao('aprovar_recomendacao'),
  validateParam('id', uuidSchema),
  validateBody(atualizarRecomendacaoSchema),
  asyncHandler(async (req, res) => {
    const { db, agenciaId, usuarioId } = getAuth(req);
    const recomendacaoId = uuidSchema.parse(req.params.id);
    const patch = req.body as AtualizarRecomendacao;
    const data = await atualizarRecomendacao(db, { agenciaId, usuarioId, recomendacaoId, patch });
    res.json({ data });
  }),
);

// Regras de otimização (guardrails do Plan do PDCA).
pdcaRouter.get(
  '/regras-otimizacao',
  asyncHandler(async (req, res) => {
    const query = listarRegrasQuerySchema.safeParse(req.query);
    if (!query.success) throw new HttpError(422, 'Query inválida', query.error.flatten());
    const { db } = getAuth(req);
    const data = await listarRegras(db, query.data);
    res.json({ data });
  }),
);

pdcaRouter.post(
  '/regras-otimizacao',
  requireAcao('aprovar_recomendacao'),
  validateBody(criarRegraOtimizacaoSchema),
  asyncHandler(async (req, res) => {
    const { db, agenciaId } = getAuth(req);
    const payload = req.body as CriarRegraOtimizacao;
    const data = await criarRegra(db, agenciaId, payload);
    res.status(201).json({ data });
  }),
);

pdcaRouter.patch(
  '/regras-otimizacao/:id',
  requireAcao('aprovar_recomendacao'),
  validateParam('id', uuidSchema),
  validateBody(atualizarRegraOtimizacaoSchema),
  asyncHandler(async (req, res) => {
    const { db } = getAuth(req);
    const id = uuidSchema.parse(req.params.id);
    const patch = req.body as AtualizarRegraOtimizacao;
    const data = await atualizarRegra(db, id, patch.ativo);
    res.json({ data });
  }),
);
