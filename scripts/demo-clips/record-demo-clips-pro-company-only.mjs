import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const APP_URL = process.env.APP_URL || 'https://app.verijob.es';
const COMPANY_STATE = process.env.COMPANY_STATE;
const OUT_DIR = process.env.OUT_DIR;
const TOKEN = process.env.COMPANY_OPEN_TOKEN || '';

const VIEWPORT = { width: 1720, height: 1080 };

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function smoothHover(page, selector) {
  const el = page.locator(selector).first();
  if (await el.count()) {
    await el.hover();
    await sleep(800);
  }
}

async function cinematicPause(page, ms = 1400) {
  await page.waitForTimeout(ms);
}

async function newContext(browser, storageState, name) {
  const dir = path.join(OUT_DIR, name);
  await ensureDir(dir);

  return browser.newContext({
    storageState,
    viewport: VIEWPORT,
    recordVideo: {
      dir,
      size: VIEWPORT
    }
  });
}

async function save(context, name) {
  const page = context.pages()[0];
  const video = page.video();
  await context.close();

  const target = path.join(OUT_DIR, `${name}.webm`);
  await fs.copyFile(await video.path(), target);
}

async function clipCompanyDashboard(browser) {
  const ctx = await newContext(browser, COMPANY_STATE, 'tmp-dashboard');
  const page = await ctx.newPage();

  await page.goto(`${APP_URL}/company`, { waitUntil: 'networkidle' });
  await cinematicPause(page, 2200);

  await smoothHover(page, 'text=Candidatos para decidir');
  await cinematicPause(page, 1200);

  await save(ctx, '01-company-dashboard');
}

async function clipCompanyCandidates(browser) {
  const ctx = await newContext(browser, COMPANY_STATE, 'tmp-candidates');
  const page = await ctx.newPage();

  await page.goto(`${APP_URL}/company/candidates`, { waitUntil: 'networkidle' });
  await cinematicPause(page, 2200);

  await page.mouse.wheel(0, 350);
  await cinematicPause(page, 900);

  const full = page.locator('text=Ver perfil completo').first();
  const open = page.locator('text=Abrir perfil completo').first();
  const summary = page.locator('text=Ver resumen').first();

  if (await full.count()) {
    await full.hover();
    await cinematicPause(page, 900);
  } else if (await open.count()) {
    await open.hover();
    await cinematicPause(page, 900);
  } else if (await summary.count()) {
    await summary.hover();
    await cinematicPause(page, 900);
  }

  if (await full.count()) {
    await full.click().catch(() => null);
    await cinematicPause(page, 1800);
  } else if (await open.count()) {
    await open.click().catch(() => null);
    await cinematicPause(page, 1800);
  }

  await save(ctx, '02-company-candidates');
}

async function clipCompanyRequests(browser) {
  const ctx = await newContext(browser, COMPANY_STATE, 'tmp-requests');
  const page = await ctx.newPage();

  await page.goto(`${APP_URL}/company/requests`, { waitUntil: 'networkidle' });
  await cinematicPause(page, 2200);

  await smoothHover(page, 'text=Resolver pendientes');
  await cinematicPause(page, 1200);

  await save(ctx, '03-company-requests');
}

async function clipCompanyPublicUnlock(browser) {
  if (!TOKEN.trim()) return;

  const ctx = await newContext(browser, COMPANY_STATE, 'tmp-public-unlock');
  const page = await ctx.newPage();

  await page.goto(`${APP_URL}/p/${TOKEN}`, { waitUntil: 'networkidle' });
  await cinematicPause(page, 2200);

  const full = page.locator('text=Ver perfil completo (-1 acceso)').first();
  const open = page.locator('text=Abrir perfil completo').first();
  const generic = page.locator('text=Ver perfil completo').first();

  if (await full.count()) {
    await full.hover();
    await cinematicPause(page, 800);
    await full.click().catch(() => null);
    await cinematicPause(page, 1800);
  } else if (await open.count()) {
    await open.hover();
    await cinematicPause(page, 800);
    await open.click().catch(() => null);
    await cinematicPause(page, 1800);
  } else if (await generic.count()) {
    await generic.hover();
    await cinematicPause(page, 800);
    await generic.click().catch(() => null);
    await cinematicPause(page, 1800);
  }

  await save(ctx, '04-company-public-unlock');
}

async function main() {
  await ensureDir(OUT_DIR);

  const browser = await chromium.launch({
    headless: true,
    slowMo: 120
  });

  try {
    await clipCompanyDashboard(browser);
    await clipCompanyCandidates(browser);
    await clipCompanyRequests(browser);
    await clipCompanyPublicUnlock(browser);
  } finally {
    await browser.close();
  }

  console.log('COMPANY_CLIPS_READY ->', OUT_DIR);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
