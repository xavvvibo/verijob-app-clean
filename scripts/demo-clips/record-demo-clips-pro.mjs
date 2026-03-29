import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const APP_URL = process.env.APP_URL || 'https://app.verijob.es';
const AUTH_DIR = process.env.AUTH_DIR;
const CANDIDATE_STATE = process.env.CANDIDATE_STATE;
const COMPANY_STATE = process.env.COMPANY_STATE;
const OUT_DIR = process.env.OUT_DIR;

const TOKEN = process.env.CANDIDATE_PUBLIC_TOKEN || '';

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

async function clipCandidateOverview(browser) {
  const ctx = await newContext(browser, CANDIDATE_STATE, 'tmp1');
  const page = await ctx.newPage();

  await page.goto(`${APP_URL}/candidate/overview`, { waitUntil: 'networkidle' });

  await cinematicPause(page, 2000);

  await smoothHover(page, 'text=Nivel de confianza');
  await cinematicPause(page);

  await smoothHover(page, 'text=Subir evidencia');
  await cinematicPause(page);

  await save(ctx, '01-overview');
}

async function clipCandidateShare(browser) {
  const ctx = await newContext(browser, CANDIDATE_STATE, 'tmp2');
  const page = await ctx.newPage();

  await page.goto(`${APP_URL}/candidate/share`, { waitUntil: 'networkidle' });

  await cinematicPause(page, 2000);

  await smoothHover(page, 'text=Copiar enlace público');
  await cinematicPause(page);

  if (TOKEN) {
    await page.goto(`${APP_URL}/p/${TOKEN}`, { waitUntil: 'networkidle' });
    await cinematicPause(page, 2000);
  }

  await save(ctx, '02-share');
}

async function clipCompanyDashboard(browser) {
  const ctx = await newContext(browser, COMPANY_STATE, 'tmp3');
  const page = await ctx.newPage();

  await page.goto(`${APP_URL}/company`, { waitUntil: 'networkidle' });

  await cinematicPause(page, 2000);

  await smoothHover(page, 'text=Candidatos para decidir');
  await cinematicPause(page);

  await save(ctx, '03-dashboard');
}

async function clipCompanyCandidates(browser) {
  const ctx = await newContext(browser, COMPANY_STATE, 'tmp4');
  const page = await ctx.newPage();

  await page.goto(`${APP_URL}/company/candidates`, { waitUntil: 'networkidle' });

  await cinematicPause(page, 2000);

  await page.mouse.wheel(0, 400);
  await cinematicPause(page);

  await smoothHover(page, 'text=Ver perfil completo');
  await cinematicPause(page);

  const clicked = await page.locator('text=Ver perfil completo').first().click().catch(() => null);

  if (clicked !== null) {
    await cinematicPause(page, 2000);
  }

  await save(ctx, '04-candidates');
}

async function main() {
  await ensureDir(OUT_DIR);

  const browser = await chromium.launch({
    headless: true,
    slowMo: 120
  });

  try {
    await clipCandidateOverview(browser);
    await clipCandidateShare(browser);
    await clipCompanyDashboard(browser);
    await clipCompanyCandidates(browser);
  } finally {
    await browser.close();
  }

  console.log('CLIPS READY →', OUT_DIR);
}

main();
