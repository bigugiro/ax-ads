/**
 * Rotas de campanhas (Sprint 3) — listar e OPERAR (pausar/ativar/ajustar budget)
 * via `AdsProvider`. Toda ação: aplica no provedor → atualiza o espelho → grava
 * em `audit_log` (regra 5 do CLAUDE.md). Papel mínimo: gestor (`operar_campanha`).
 */
import { atualizarCampanhaSchema, listarCampanhasQuerySchema, uuidSchema } from '@ax-ads/shared';
import type { AtualizarCampanha } from '@ax-ads/shared';
import { Router } from 'express';
import { getAuth } from '../lib/auth-context';
import { registrarAudit, type Campos } from '../lib/audit';
import { asyncHandler, HttpError } from '../lib/http';
import { authenticate } from '../middleware/auth';
import { requireAcao } from '../middleware/require-role';
import { validateBody, validateParam } from '../middleware/validate';
import { getProvider } from '../providers';
import { listarCampanhas } from '../services/listar-campanhas';

export const campanhasRouter: Router = Router();

campanhasRouter.use(authenticate);

// Listar campanhas do espelho (qualquer papel; RLS filtra por agência).
campanhasRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = listarCampanhasQuerySchema.safeParse(req.query);
    if (!query.success) throw new HttpError(422, 'Query inválida', query.error.flatten());

    const { db } = getAuth(req);
    const data = await listarCampanhas(db, query.data);
    res.json({ data });
  }),
);

// Operar campanha: pausar/ativar e/ou ajustar budget (gestor+).
campanhasRouter.patch(
  '/:id',
  requireAcao('operar_campanha'),
  validateParam('id', uuidSchema),
  validateBody(atualizarCampanhaSchema),
  asyncHandler(async (req, res) => {
    const { db, agenciaId, usuarioId } = getAuth(req);
    const id = uuidSchema.parse(req.params.id);
    const patch = req.body as AtualizarCampanha;

    // Campanha (RLS garante que só vem se for da agência).
    const { data: campanha, error: cmpErr } = await db
      .from('campanhas')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (cmpErr) throw new HttpError(500, 'Falha ao carregar campanha', cmpErr.message);
    if (!campanha) throw new HttpError(404, 'Campanha não encontrada');

    // Conta dona: precisa do id externo/plataforma e estar ativa para operar.
    const { data: conta, error: contaErr } = await db
      .from('contas_anuncio')
      .select('external_account_id, plataforma, status')
      .eq('id', campanha.conta_anuncio_id)
      .maybeSingle();
    if (contaErr) throw new HttpError(500, 'Falha ao carregar conta', contaErr.message);
    if (!conta) throw new HttpError(404, 'Conta da campanha não encontrada');
    if (conta.status !== 'ativa') {
      throw new HttpError(409, `Conta "${conta.status}" não opera campanhas — reative antes`);
    }

    // 1) Aplica no provedor (fonte externa). Se falhar, o espelho não é tocado.
    const provider = getProvider(conta.plataforma);
    try {
      if (patch.status !== undefined) {
        await provider.atualizarStatusCampanha(
          conta.external_account_id,
          campanha.external_id,
          patch.status,
        );
      }
      if (patch.budget !== undefined) {
        await provider.atualizarBudgetCampanha(
          conta.external_account_id,
          campanha.external_id,
          patch.budget,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'erro desconhecido';
      throw new HttpError(502, 'Falha ao aplicar a mudança no provedor', msg);
    }

    // 2) Espelha no banco só o que mudou.
    const mudancas: { status?: 'ativa' | 'pausada'; budget?: number } = {};
    if (patch.status !== undefined) mudancas.status = patch.status;
    if (patch.budget !== undefined) mudancas.budget = patch.budget;

    const { data: depois, error: updErr } = await db
      .from('campanhas')
      .update(mudancas)
      .eq('id', id)
      .select('*')
      .single();
    if (updErr || !depois) throw new HttpError(500, 'Falha ao atualizar campanha', updErr?.message);

    // 3) Auditoria (regra 5): registra antes/depois só dos campos tocados.
    const antes: Campos = {};
    const depoisAudit: Campos = {};
    if (patch.status !== undefined) {
      antes.status = campanha.status;
      depoisAudit.status = depois.status;
    }
    if (patch.budget !== undefined) {
      antes.budget = campanha.budget;
      depoisAudit.budget = depois.budget;
    }
    await registrarAudit({
      agencia_id: agenciaId,
      usuario_id: usuarioId,
      acao: 'operar',
      entidade: 'campanha',
      antes,
      depois: depoisAudit,
    });

    res.json({ data: depois });
  }),
);
