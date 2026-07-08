/**
 * Rotas de billing (Sprint 9, Seção 5 do plano). Assinar/trocar de plano e
 * cancelar exigem `gerenciar_billing` (owner — CLAUDE.md: billing é
 * sensível). Leitura via RLS (select só gestor+, ver 0017_billing_rls.sql).
 * O webhook é PÚBLICO (o Pagar.me não manda JWT de usuário) e autorizado por
 * Basic Auth fail-closed — mesma decisão do `CRON_SECRET` (Sprint 2).
 */
import { criarCheckoutSchema, webhookBillingSchema } from '@ax-ads/shared';
import type { CriarCheckout, WebhookBilling } from '@ax-ads/shared';
import { Router } from 'express';
import { getAuth } from '../lib/auth-context';
import { verificarBillingWebhookAuth } from '../lib/billing-webhook-auth';
import { getEnv } from '../lib/env';
import { asyncHandler, HttpError } from '../lib/http';
import { rateLimit } from '../lib/rate-limit';
import { authenticate } from '../middleware/auth';
import { requireAcao } from '../middleware/require-role';
import { validateBody } from '../middleware/validate';
import {
  buscarAssinatura,
  cancelarAssinatura,
  criarCheckout,
  processarWebhookBilling,
} from '../services/billing';

export const billingRouter: Router = Router();

billingRouter.get(
  '/assinatura',
  authenticate,
  asyncHandler(async (req, res) => {
    const { db, agenciaId } = getAuth(req);
    const data = await buscarAssinatura(db, agenciaId);
    res.json({ data });
  }),
);

billingRouter.post(
  '/billing/checkout',
  authenticate,
  requireAcao('gerenciar_billing'),
  validateBody(criarCheckoutSchema),
  asyncHandler(async (req, res) => {
    const { agenciaId, usuarioId, db } = getAuth(req);
    const payload = req.body as CriarCheckout;

    const { data: agencia, error: agErr } = await db
      .from('agencias')
      .select('nome')
      .eq('id', agenciaId)
      .single();
    if (agErr || !agencia) throw new HttpError(500, 'Falha ao carregar agência', agErr?.message);
    const { data: usuario, error: userErr } = await db
      .from('usuarios')
      .select('email')
      .eq('id', usuarioId)
      .single();
    if (userErr || !usuario) throw new HttpError(500, 'Falha ao carregar usuário', userErr?.message);

    const data = await criarCheckout({
      agenciaId,
      usuarioId,
      nomeAgencia: agencia.nome,
      emailUsuario: usuario.email,
      plano: payload.plano,
    });
    res.status(201).json({ data });
  }),
);

billingRouter.post(
  '/billing/cancelar',
  authenticate,
  requireAcao('gerenciar_billing'),
  asyncHandler(async (req, res) => {
    const { agenciaId, usuarioId } = getAuth(req);
    const data = await cancelarAssinatura({ agenciaId, usuarioId });
    res.json({ data });
  }),
);

billingRouter.post(
  '/billing/webhook',
  // Pen-test básico (Sprint 10): rota pública — limita abuso mesmo autenticado por Basic Auth.
  rateLimit('billing-webhook', { limite: 30, janelaMs: 60_000 }),
  validateBody(webhookBillingSchema),
  asyncHandler(async (req, res) => {
    const status = verificarBillingWebhookAuth(req.header('authorization'), getEnv().PAGARME_WEBHOOK_AUTH);
    if (status === 'nao_configurado') {
      throw new HttpError(503, 'Webhook de billing indisponível: PAGARME_WEBHOOK_AUTH não configurado');
    }
    if (status === 'invalido') {
      throw new HttpError(401, 'Webhook não autorizado');
    }
    const payload = req.body as WebhookBilling;
    await processarWebhookBilling(payload);
    res.json({ data: { ok: true } });
  }),
);
