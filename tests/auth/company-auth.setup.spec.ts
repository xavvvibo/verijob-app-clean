import { test, expect } from '@playwright/test';

const BASE_URL = 'https://app.verijob.es';
const COMPANY_EMAIL = 'javier@lapicateria.es';
const AUTH_STATE_PATH = '/Users/xavibocanegra/VERIJOB/verijob-app/playwright/.auth/company.json';

test('guardar sesion empresa estable', async ({ page, context }) => {
  await page.goto(`${BASE_URL}/login?mode=company`);
  await page.waitForLoadState('domcontentloaded');

  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  await expect(emailInput).toBeVisible({ timeout: 20000 });
  await emailInput.fill(COMPANY_EMAIL);

  const sendButton = page.getByRole('button', { name: /enviar c[oó]digo|enviar|continuar/i }).first();
  await expect(sendButton).toBeVisible({ timeout: 10000 });
  await sendButton.click();

  console.log('\n=== ACCION MANUAL REQUERIDA ===');
  console.log('1) Mete el OTP manualmente');
  console.log('2) Espera a entrar al dashboard empresa');
  console.log('3) Cuando ya estes dentro, pulsa RESUME en el inspector');
  console.log(`4) El storageState se guardara en: ${AUTH_STATE_PATH}\n`);

  await page.waitForURL(/\/company|\/dashboard|\/company\/.*$/i, { timeout: 180000 });
  await page.waitForLoadState('domcontentloaded');
  await expect(page).not.toHaveURL(/\/login|\/signup/i);

  await page.pause();

  await context.storageState({ path: AUTH_STATE_PATH });
  console.log(`\nAUTH_STATE_SAVED=${AUTH_STATE_PATH}\n`);
});
