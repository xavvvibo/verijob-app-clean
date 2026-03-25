import { test, expect } from '@playwright/test';

const BASE_URL = 'https://app.verijob.es';
const TOKEN = '9b3383905a508e4de1f9700412e3559a07bd82e399c3989b';

async function readAvailableAccesses(page: any) {
  await page.goto(`${BASE_URL}/company`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);

  const body = await page.locator('body').innerText();

  const match =
    body.match(/Accesos disponibles\s+(\d+)/i) ||
    body.match(/Accesos a perfiles disponibles\s+(\d+)/i) ||
    body.match(/(\d+)\s+disponibles ahora mismo/i);

  if (!match) {
    console.log('\n=== DASHBOARD BODY ===\n');
    console.log(body.slice(0, 8000));
    throw new Error('No pude leer el contador de accesos disponibles en /company');
  }

  return Number(match[1]);
}

async function dumpBody(page: any, label: string, max = 7000) {
  const body = await page.locator('body').innerText();
  console.log(`\n=== ${label} ===\n`);
  console.log(body.slice(0, max));
}

test('empresa autenticada /p/[token] -> unlock -> consumo -> reapertura', async ({ page }) => {
  // sanity auth
  await page.goto(`${BASE_URL}/company`);
  await page.waitForLoadState('domcontentloaded');
  await expect(page).not.toHaveURL(/\/login|\/signup/i);

  const accessesBefore = await readAvailableAccesses(page);
  console.log(`\nACCESOS_ANTES=${accessesBefore}\n`);

  // public profile with authenticated company session
  await page.goto(`${BASE_URL}/p/${TOKEN}`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(4000);

  const urlPublic = page.url();
  console.log(`URL_PUBLICA=${urlPublic}`);
  await dumpBody(page, 'BODY_EN_/p/TOKEN_ANTES', 5000);

  // fail fast if auth-public leaked
  const bodyPublic = (await page.locator('body').innerText()).toLowerCase();
  if (
    bodyPublic.includes('activar cuenta de empresa') ||
    bodyPublic.includes('alta empresa') ||
    bodyPublic.includes('enviar código') ||
    /\/login\?mode=company|\/signup\?mode=company/i.test(urlPublic)
  ) {
    throw new Error('Fallo real: estando autenticado como empresa, /p/[token] sigue mostrando auth pública');
  }

  // CTA resolution
  const candidateDirectLink = page.locator(`a[href="/company/candidate/${TOKEN}"]`).first();
  const unlockButton = page
    .locator('button, a')
    .filter({ hasText: /desbloquear|ver perfil completo|abrir perfil|acceder/i })
    .first();

  if (await candidateDirectLink.count()) {
    await expect(candidateDirectLink).toBeVisible({ timeout: 15000 });
    await candidateDirectLink.click();
  } else {
    await expect(unlockButton).toBeVisible({ timeout: 15000 });
    await unlockButton.click();
  }

  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(5000);

  const urlAfterCta = page.url();
  console.log(`\nURL_TRAS_CTA=${urlAfterCta}`);
  await dumpBody(page, 'BODY_TRAS_CTA', 6000);

  if (/\/login|\/signup/i.test(urlAfterCta)) {
    throw new Error(`CTA incorrecto: redirige a auth (${urlAfterCta})`);
  }

  const bodyAfterCta = (await page.locator('body').innerText()).toLowerCase();
  if (bodyAfterCta.includes('activar cuenta de empresa') || bodyAfterCta.includes('alta empresa')) {
    throw new Error('CTA incorrecto: tras pulsar CTA se muestra auth pública de empresa');
  }

  if (bodyAfterCta.includes('error')) {
    throw new Error('Error visible tras CTA/unlock');
  }

  const accessesAfterFirst = await readAvailableAccesses(page);
  console.log(`\nACCESOS_DESPUES_PRIMER_UNLOCK=${accessesAfterFirst}\n`);

  // reopen same profile
  await page.goto(`${BASE_URL}/p/${TOKEN}`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(4000);

  const bodyReopen = (await page.locator('body').innerText()).toLowerCase();
  await dumpBody(page, 'BODY_REAPERTURA', 5000);

  if (bodyReopen.includes('activar cuenta de empresa') || bodyReopen.includes('alta empresa')) {
    throw new Error('Reapertura incorrecta: reaparece auth pública tras unlock inicial');
  }

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
