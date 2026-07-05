/**
 * Jobs de cron (Sprint 2). Sem autenticação de usuário: o Vercel Cron chama
 * com `Authorization: Bearer <CRON_SECRET>`. Usa service role para varrer todas
 * as agências. Fail-closed: sem CRON_SECRET configurado, responde 503.
 */
import { Router } from 'express';
import { verificarCronSecret } from '../lib/cron-auth';
import { getEnv } from '../lib/env';
import { asyncHandler, HttpError } from '../lib/http';
import { getServiceClient } from '../lib/supabase';
import { sincronizarContasAtivas } from '../services/cron-sync';

export const cronRouter: Router = Router();

/** Barra qualquer request de cron sem o segredo válido. */
function autorizarCron(header: string | undefined): void {
  const status = verificarCronSecret(header, getEnv().CRON_SECRET);
  if (status === 'nao_configurado') {
    throw new HttpError(503, 'Cron indisponível: CRON_SECRET não configurado');
  }
  if (status === 'invalido') {
    throw new HttpError(401, 'Cron não autorizado');
  }
}

// Sync diário de métricas: re-materializa o espelho de todas as contas ativas.
cronRouter.post(
  '/sync-metricas',
  asyncHandler(async (req, res) => {
    autorizarCron(req.header('authorization'));
    const resultado = await sincronizarContasAtivas(getServiceClient());
    res.json({ data: resultado });
  }),
);
