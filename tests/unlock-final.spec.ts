import { test, expect } from '@playwright/test';

const BASE_URL = 'https://app.verijob.es';
const TOKEN = '9b3383905a508e4de1f9700412e3559a07bd82e399c3989b';
const COMPANY_EMAIL = 'javier@lapicateria.es';

async function readAvailableAccesses(page: any) {
  await page.goto(`${BASE_URL}/company`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2500);

  const text = await page.locator('body').innerText();
  const match =
    text.match(/Accesos disponibles\s+(\d+)/i) ||
    text.match(/Accesos a perfiles disponibles\s+(\d+)/i) ||
    text.match(/(\d+)\s+disponibles ahora mismo/i);

  if (!match) {
    console.log('\n=== DASHBOARD TEXT ===\n');
    console.log(text);
    throw new Error('No pude leer el contador de accesos disponibles en /company');
  }

  return Number(match[1]);
}

test('FINAL UNLOCK FLOW', async ({ page }) => {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('domcontentloaded');

  const emailInput = page.locator('input[type="email"]').first();
  await expect(emailInput).toBeVisible({ timeout: 15000 });
  await emailInput.fill(COMPANY_EMAIL);
  await emailInput.press('Enter');

  console.log('\n=== ACCION MANUAL REQUERIDA ===');
  console.log('1) Mete el OTP manualmente');
  console.log('2) Espera a entrar al dashboard empresa');
  console.log('3) Cuando ya estes dentro, pulsa RESUME en el inspector\n');

  await page.waitForURL(/\/company|\/dashboard|\/company\/.*$/i, { timeout: 180000 });
  await page.waitForLoadState('domcontentloaded');
  await expect(page).not.toHaveURL(/\/login/i);

  await page.pause();

  const accessesBefore = await readAvailableAccesses(page);
  console.log(`\nACCESOS_ANTES=${accessesBefore}\n`);

  await page.goto(`${BASE_URL}/p/${TOKEN}`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);

  const currentUrl1 = page.url();
  const body1 = await page.locator('body').innerText();

  console.log(`URL_PUBLICA=${currentUrl1}`);
  console.log('\n=== BODY_EN_/p/TOKEN_ANTES ===\n');
  console.log(body1.slice(0, 4000));

  const cta = page
    .locator('button, a')
    .filter({ hasText: /desbloquear|acceder|ver perfil completo|abrir perfil|ver perfil/i })
    .first();

  await expect(cta).toBeVisible({ timeout: 15000 });
  await cta.click();

  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(4000);

  const currentUrl2 = page.url();
  const body2 = await page.locator('body').innerText();

  console.log(`\nURL_TRAS_CTA=${currentUrl2}`);
  console.log('\n=== BODY_TRAS_CTA ===\n');
  console.log(body2.slice(0, 5000));

  if (/login|signup/i.test(currentUrl2)) {
    throw new Error(`CTA incorrecto: redirige a auth (${currentUrl2})`);
  }

  if (body2.toLowerCase().includes('error')) {
    throw new Error('Error visible tras CTA/unlock');
  }

  const accessesAfterFirst = await readAvailableAccesses(page);
  console.log(`\nACCESOS_DESPUES_PRIMER_UNLOCK=${accessesAfterFirst}\n`);

  await page.goto(`${BASE_URL}/p/${TOKEN}`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);

  const body3 = await page.locator('body').innerText();
  console.log('\n=== BODY_REAPERTURA ===\n');
  console.log(body3.slice(0, 5000));

  const accessesAfterReopen = await readAvailableAccesses(page);
  console.log(`\nACCESOS_DESPUES_REAPERTURA=${accessesAfterReopen}\n`);

  if (accessesAfterFirst !== accessesBefore - 1) {
    throw new Error(
      `Consumo incorrecto en primer unlock: antes=${accessesBefore}, despues=${accessesAfterFirst}`
    );
  }

  if (accessesAfterReopen !== accessesAfterFirst) {
    throw new Error(
      `Reapertura consumio de nuevo: despuesPrimerUnlock=${accessesAfterFirst}, despuesReapertura=${accessesAfterReopen}`
    );
  }

  console.log('\n=== RESULTADO ===');
  console.log('PASS: unlock consume 1 acceso y la reapertura no vuelve a consumir.\n');
});
