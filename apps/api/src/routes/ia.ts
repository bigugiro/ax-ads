/**
 * Rotas do Studio criativo IA (Sprint 6, Seção 5 do plano) — geração de
 * copy/headlines via Sonnet, classificação via Haiku, log de custo.
 * Escrita exige `gerenciar_criativos` (gestor+); leitura, qualquer papel.
 */
import {
  analisarCriativoSchema,
  gerarCopySchema,
  gerarHeadlinesSchema,
  listarCriativosQuerySchema,
  uuidSchema,
} from '@ax-ads/shared';
import type { AnalisarCriativo, GerarCopy, GerarHeadlines } from '@ax-ads/shared';
import { Router } from 'express';
import { getAuth } from '../lib/auth-context';
import { asyncHandler, HttpError } from '../lib/http';
import { authenticate } from '../middleware/auth';
import { requireAcao } from '../middleware/require-role';
import { validateBody, validateParam } from '../middleware/validate';
import {
  analisarCriativo,
  gerarVariacoes,
  listarCriativos,
  listarGeracoesIA,
} from '../services/ia';

export const iaRouter: Router = Router();

iaRouter.use(authenticate);

iaRouter.post(
  '/ia/copy',
  requireAcao('gerenciar_criativos'),
  validateBody(gerarCopySchema),
  asyncHandler(async (req, res) => {
    const { db, agenciaId } = getAuth(req);
    const payload = req.body as GerarCopy;
    const data = await gerarVariacoes(db, { agenciaId, tipo: 'copy', payload });
    res.status(201).json({ data });
  }),
);

iaRouter.post(
  '/ia/headlines',
  requireAcao('gerenciar_criativos'),
  validateBody(gerarHeadlinesSchema),
  asyncHandler(async (req, res) => {
    const { db, agenciaId } = getAuth(req);
    const payload = req.body as GerarHeadlines;
    const data = await gerarVariacoes(db, { agenciaId, tipo: 'headline', payload });
    res.status(201).json({ data });
  }),
);

iaRouter.post(
  '/ia/analise',
  requireAcao('gerenciar_criativos'),
  validateBody(analisarCriativoSchema),
  asyncHandler(async (req, res) => {
    const { db, agenciaId } = getAuth(req);
    const payload = req.body as AnalisarCriativo;
    const data = await analisarCriativo(db, { agenciaId, payload });
    res.status(201).json({ data });
  }),
);

// Leitura: criativos e o log de custo do cliente (qualquer papel).
iaRouter.get(
  '/clientes/:id/criativos',
  validateParam('id', uuidSchema),
  asyncHandler(async (req, res) => {
    const query = listarCriativosQuerySchema.safeParse(req.query);
    if (!query.success) throw new HttpError(422, 'Query inválida', query.error.flatten());
    const { db } = getAuth(req);
    const data = await listarCriativos(db, uuidSchema.parse(req.params.id), query.data);
    res.json({ data });
  }),
);

iaRouter.get(
  '/clientes/:id/geracoes-ia',
  validateParam('id', uuidSchema),
  asyncHandler(async (req, res) => {
    const { db } = getAuth(req);
    const data = await listarGeracoesIA(db, uuidSchema.parse(req.params.id));
    res.json({ data });
  }),
);
