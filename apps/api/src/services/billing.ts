/**
 * Billing (Sprint 9, Seção 4/5 do plano) — onboarding self-service e
 * assinaturas via `BillingProvider` (hoje só `demo`, sem chave Pagar.me).
 * Toda escrita usa a SERVICE ROLE (mesmo padrão de `audit_log`): o signup
 * roda antes de existir sessão, e checkout/cancelar/webhook nunca deixam
 * o usuário escrever direto em `assinaturas` (só o backend, com o
 * `agenciaId` sempre vindo do contexto autenticado — nunca do payload).
 */
import type { Assinatura, Plano, Signup, StatusAssinatura, WebhookBilling } from '@ax-ads/shared';
import { registrarAudit } from '../lib/audit';
import { HttpError } from '../lib/http';
import type { DbClient } from '../lib/supabase';
import { getServiceClient } from '../lib/supabase';
import { getBillingProvider } from '../providers/billing-index';

/** Onboarding self-service: cria conta, agência, usuário owner e assinatura — sem intervenção manual. */
export async function criarSignup(
  payload: Signup,
): Promise<{ agenciaId: string; plano: Plano; status: StatusAssinatura }> {
  const service = getServiceClient();

  const { data: authData, error: authErr } = await service.auth.admin.createUser({
    email: payload.email,
    password: payload.senha,
    email_confirm: true,
  });
  if (authErr || !authData.user) {
    throw new HttpError(409, 'Não foi possível criar a conta', authErr?.message);
  }

  try {
    const { data: agencia, error: agErr } = await service
      .from('agencias')
      .insert({ nome: payload.nome_agencia, plano: payload.plano })
      .select('id')
      .single();
    if (agErr || !agencia) throw new HttpError(500, 'Falha ao criar agência', agErr?.message);

    const { error: userErr } = await service.from('usuarios').insert({
      agencia_id: agencia.id,
      nome: payload.nome,
      email: payload.email,
      papel: 'owner',
      auth_supabase_id: authData.user.id,
    });
    if (userErr) throw new HttpError(500, 'Falha ao criar usuário', userErr.message);

    const criada = await getBillingProvider().criarAssinatura({
      plano: payload.plano,
      cliente: { nome: payload.nome_agencia, email: payload.email },
    });

    const { error: assErr } = await service.from('assinaturas').insert({
      agencia_id: agencia.id,
      plano: payload.plano,
      status: criada.status,
      pagarme_customer_id: criada.customerId,
      pagarme_subscription_id: criada.subscriptionId,
    });
    if (assErr) throw new HttpError(500, 'Falha ao criar assinatura', assErr.message);

    await registrarAudit({
      agencia_id: agencia.id,
      usuario_id: null,
      acao: 'signup',
      entidade: 'assinatura',
      antes: null,
      depois: { plano: payload.plano, status: criada.status, aceite_termos: payload.aceite_termos },
    });

    return { agenciaId: agencia.id, plano: payload.plano, status: criada.status };
  } catch (err) {
    // Sem agência/assinatura, a conta de auth fica órfã e inutilizável — remove.
    await service.auth.admin.deleteUser(authData.user.id).catch(() => {});
    throw err;
  }
}

export async function buscarAssinatura(
  db: DbClient,
  agenciaId: string,
): Promise<Assinatura | null> {
  const { data, error } = await db
    .from('assinaturas')
    .select('*')
    .eq('agencia_id', agenciaId)
    .maybeSingle();
  if (error) throw new HttpError(500, 'Falha ao carregar assinatura', error.message);
  return data;
}

/** Assina (primeira vez) ou troca de plano — upsert por `agencia_id`. */
export async function criarCheckout(params: {
  agenciaId: string;
  usuarioId: string;
  nomeAgencia: string;
  emailUsuario: string;
  plano: Plano;
}): Promise<Assinatura> {
  const { agenciaId, usuarioId, nomeAgencia, emailUsuario, plano } = params;
  const service = getServiceClient();

  const { data: atual } = await service
    .from('assinaturas')
    .select('id, status')
    .eq('agencia_id', agenciaId)
    .maybeSingle();

  const criada = await getBillingProvider().criarAssinatura({
    plano,
    cliente: { nome: nomeAgencia, email: emailUsuario },
  });

  const linha = {
    agencia_id: agenciaId,
    plano,
    status: criada.status,
    pagarme_customer_id: criada.customerId,
    pagarme_subscription_id: criada.subscriptionId,
    atualizado_em: new Date().toISOString(),
  };

  const { data: assinatura, error } = atual
    ? await service.from('assinaturas').update(linha).eq('id', atual.id).select('*').single()
    : await service.from('assinaturas').insert(linha).select('*').single();
  if (error || !assinatura) throw new HttpError(500, 'Falha ao salvar assinatura', error?.message);

  // Mantém `agencias.plano` (denormalizado, lido em outras partes do app) em sincronia.
  await service.from('agencias').update({ plano }).eq('id', agenciaId);

  await registrarAudit({
    agencia_id: agenciaId,
    usuario_id: usuarioId,
    acao: 'checkout',
    entidade: 'assinatura',
    antes: atual ? { status: atual.status } : null,
    depois: { plano, status: criada.status },
  });

  return assinatura;
}

export async function cancelarAssinatura(params: {
  agenciaId: string;
  usuarioId: string;
}): Promise<Assinatura> {
  const { agenciaId, usuarioId } = params;
  const service = getServiceClient();

  const { data: atual, error: buscaErr } = await service
    .from('assinaturas')
    .select('*')
    .eq('agencia_id', agenciaId)
    .maybeSingle();
  if (buscaErr) throw new HttpError(500, 'Falha ao carregar assinatura', buscaErr.message);
  if (!atual) throw new HttpError(404, 'Nenhuma assinatura para cancelar');

  if (atual.pagarme_subscription_id) {
    await getBillingProvider().cancelarAssinatura(atual.pagarme_subscription_id);
  }

  const { data: cancelada, error } = await service
    .from('assinaturas')
    .update({ status: 'cancelada', atualizado_em: new Date().toISOString() })
    .eq('id', atual.id)
    .select('*')
    .single();
  if (error || !cancelada) throw new HttpError(500, 'Falha ao cancelar assinatura', error?.message);

  await registrarAudit({
    agencia_id: agenciaId,
    usuario_id: usuarioId,
    acao: 'cancelar',
    entidade: 'assinatura',
    antes: { status: atual.status },
    depois: { status: 'cancelada' },
  });

  return cancelada;
}

/**
 * Efeito colateral do webhook (Sprint 9): atualiza o status pelo id externo
 * da assinatura. Formato do payload é PROVISÓRIO — ver comentário em
 * `packages/shared/src/billing.ts`.
 */
export async function processarWebhookBilling(payload: WebhookBilling): Promise<void> {
  const service = getServiceClient();

  const { data: atual, error: buscaErr } = await service
    .from('assinaturas')
    .select('id, agencia_id, status')
    .eq('pagarme_subscription_id', payload.pagarme_subscription_id)
    .maybeSingle();
  if (buscaErr) throw new HttpError(500, 'Falha ao carregar assinatura', buscaErr.message);
  if (!atual) throw new HttpError(404, 'Assinatura não encontrada para este subscription_id');

  const { error } = await service
    .from('assinaturas')
    .update({ status: payload.status, atualizado_em: new Date().toISOString() })
    .eq('id', atual.id);
  if (error) throw new HttpError(500, 'Falha ao atualizar assinatura', error.message);

  await registrarAudit({
    agencia_id: atual.agencia_id,
    usuario_id: null,
    acao: 'webhook',
    entidade: 'assinatura',
    antes: { status: atual.status },
    depois: { status: payload.status },
  });
}
