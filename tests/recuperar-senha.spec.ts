/** Fluxo de recuperação de senha (Supabase Auth, sem API). Não envia e-mail real:
 *  cobre navegação, validação client-side e o link inválido/expirado. */
import { expect, test } from '@playwright/test';

test('login expõe o link "Esqueci minha senha" e leva à recuperação', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('link', { name: 'Esqueci minha senha' }).click();
  await expect(page).toHaveURL(/\/recuperar-senha$/);
  await expect(page.getByRole('button', { name: /Enviar link/i })).toBeVisible();
});

test('recuperar-senha valida e-mail inválido no cliente', async ({ page }) => {
  await page.goto('/recuperar-senha');
  await page.getByLabel('E-mail').fill('nao-e-email');
  await page.getByRole('button', { name: /Enviar link/i }).click();
  await expect(page.getByText('E-mail inválido')).toBeVisible();
});

test('redefinir-senha sem token de recovery mostra link inválido', async ({ page }) => {
  await page.goto('/redefinir-senha');
  await expect(page.getByText('Link inválido ou expirado')).toBeVisible();
});
