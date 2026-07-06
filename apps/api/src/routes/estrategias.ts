/**
 * Rotas de Estratégias (Sprint 4, Seção 6 do plano) — a feature de destaque.
 * Catálogo é leitura pública (a qualquer papel autenticado); aplicar/mover
 * status/checar item exige `aplicar_estrategia` (gestor+). Mudança de status
 * da aplicação é auditada (lifecycle relevante, mesmo não sendo budget/campanha).
 */
import {
  atualizarChecklistItemSchema,
  atualizarEstrategiaAplicadaSchema,
  listarEstrategiasQuerySchema,
  uuidSchema,
} from '@ax-ads/shared';
import type { AtualizarChecklistItem, AtualizarEstrategiaAplicada } from '@ax-ads/shared';
import { Router } from 'express';
import { getAuth } from '../lib/auth-context';
import { registrarAudit } from '../lib/audit';
import { asyncHandler, HttpError } from '../lib/http';
import { authenticate } from '../middleware/auth';
import { requireAcao } from '../middleware/require-role';
import { validateBody, validateParam } from '../middleware/validate';
import {
  aplicarEstrategia,
  atualizarAplicada,
  atualizarChecklistItem,
  buscarEstrategia,
  listarAplicadasPorCliente,
  listarCatalogo,
} from '../services/estrategias';

export const estrategiasRouter: Router = Router();

estrategiasRouter.use(authenticate);

// Catálogo (jornada "Analisar" — Seção 6.2): qualquer papel autenticado.
estrategiasRouter.get(
  '/estrategias',
  asyncHandler(async (req, res) => {
    const query = listarEstrategiasQuerySchema.safeParse(req.query);
    if (!query.success) throw new HttpError(422, 'Query inválida', query.error.flatten());
    const { db } = getAuth(req);
    const data = await listarCatalogo(db, query.data);
    res.json({ data });
  }),
);

// Detalhe (jornada "Detalhe" — Seção 6.2).
estrategiasRouter.get(
  '/estrategias/:id',
  validateParam('id', uuidSchema),
  asyncHandler(async (req, res) => {
    const { db } = getAuth(req);
    const data = await buscarEstrategia(db, uuidSchema.parse(req.params.id));
    res.json({ data });
  }),
);

// Aplicar (jornada "Incluir" — Seção 6.2): cria a instância + checklist + baseline.
estrategiasRouter.post(
  '/clientes/:clienteId/estrategias/:estrategiaId/aplicar',
  requireAcao('aplicar_estrategia'),
  validateParam('clienteId', uuidSchema),
  validateParam('estrategiaId', uuidSchema),
  asyncHandler(async (req, res) => {
    const { db, agenciaId, usuarioId } = getAuth(req);
    const clienteId = uuidSchema.parse(req.params.clienteId);
    const estrategiaId = uuidSchema.parse(req.params.estrategiaId);

    const aplicada = await aplicarEstrategia(db, { agenciaId, clienteId, estrategiaId });

    await registrarAudit({
      agencia_id: agenciaId,
      usuario_id: usuarioId,
      acao: 'aplicar',
      entidade: 'estrategia_aplicada',
      antes: null,
      depois: { id: aplicada.id, estrategia_id: estrategiaId, cliente_id: clienteId },
    });

    res.status(201).json({ data: aplicada });
  }),
);

// Acompanhar (jornada "Acompanhar" — Seção 6.2): status + progresso + resultado medido.
estrategiasRouter.get(
  '/clientes/:clienteId/estrategias-aplicadas',
  validateParam('clienteId', uuidSchema),
  asyncHandler(async (req, res) => {
    const { db } = getAuth(req);
    const data = await listarAplicadasPorCliente(db, uuidSchema.parse(req.params.clienteId));
    res.json({ data });
  }),
);

// Mover status (analisando/aplicada/pausada/concluida) e/ou anotar.
estrategiasRouter.patch(
  '/estrategias-aplicadas/:id',
  requireAcao('aplicar_estrategia'),
  validateParam('id', uuidSchema),
  validateBody(atualizarEstrategiaAplicadaSchema),
  asyncHandler(async (req, res) => {
    const { agenciaId, usuarioId, db } = getAuth(req);
    const id = uuidSchema.parse(req.params.id);
    const patch = req.body as AtualizarEstrategiaAplicada;

    const { antes, depois } = await atualizarAplicada(db, id, patch);

    if (patch.status !== undefined) {
      await registrarAudit({
        agencia_id: agenciaId,
        usuario_id: usuarioId,
        acao: 'atualizar',
        entidade: 'estrategia_aplicada',
        antes: { status: antes.status },
        depois: { status: depois.status },
      });
    }

    res.json({ data: depois });
  }),
);

// Marcar/desmarcar item do checklist executável.
estrategiasRouter.patch(
  '/estrategia-checklist/:id',
  requireAcao('aplicar_estrategia'),
  validateParam('id', uuidSchema),
  validateBody(atualizarChecklistItemSchema),
  asyncHandler(async (req, res) => {
    const { db } = getAuth(req);
    const id = uuidSchema.parse(req.params.id);
    const patch = req.body as AtualizarChecklistItem;
    const data = await atualizarChecklistItem(db, id, patch);
    res.json({ data });
  }),
);
