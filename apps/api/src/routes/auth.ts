/**
 * Onboarding self-service (Sprint 9, Seção 5 do plano) — rota PÚBLICA (sem
 * `authenticate`): cria a conta do Supabase Auth, a agência, o usuário
 * `owner` e a assinatura em uma única chamada. DoD: "assinar e usar sem
 * intervenção manual" — o front loga em seguida com o e-mail/senha enviados.
 */
import { signupSchema } from '@ax-ads/shared';
import type { Signup } from '@ax-ads/shared';
import { Router } from 'express';
import { asyncHandler } from '../lib/http';
import { validateBody } from '../middleware/validate';
import { criarSignup } from '../services/billing';

export const authRouter: Router = Router();

authRouter.post(
  '/auth/signup',
  validateBody(signupSchema),
  asyncHandler(async (req, res) => {
    const payload = req.body as Signup;
    const data = await criarSignup(payload);
    res.status(201).json({ data });
  }),
);
