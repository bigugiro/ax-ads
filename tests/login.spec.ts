/** Fluxo mobile crítico: login real + navegação pela bottom-nav. */
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { CRED_FILE, type E2EUser } from './support/paths';

function usuario(): E2EUser {
  return JSON.parse(readFileSync(CRED_FILE, 'utf8')) as E2EUser;
}

test('login redireciona ao dashboard e a bottom-nav navega', async ({ page }) => {
  const { email, password } = usuario();

  // Rota protegida sem sessão → cai no login.
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();

  // Autenticado → Dashboard.
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  // Navegação pela bottom-nav (5 abas do plano).
  const nav = page.getByRole('navigation', { name: 'Navegação principal' });
  await nav.getByRole('link', { name: 'Estratégias' }).click();
  await expect(page.getByRole('heading', { name: 'Estratégias' })).toBeVisible();

  await nav.getByRole('link', { name: 'CRM' }).click();
  await expect(page.getByRole('heading', { name: 'CRM' })).toBeVisible();

  await nav.getByRole('link', { name: 'Mais' }).click();
  await expect(page.getByTestId('user-email')).toHaveText(email);
});

test('credenciais inválidas mostram erro', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill('nao-existe@example.com');
  await page.getByLabel('Senha').fill('senhaerrada');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
});
