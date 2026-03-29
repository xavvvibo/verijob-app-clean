import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const APP_URL = process.env.APP_URL || 'https://app.verijob.es';
const AUTH_DIR = process.env.AUTH_DIR || '/Users/xavibocanegra/VERIJOB/verijob-app/playwright/.auth';
const CANDIDATE_STATE = process.env.CANDIDATE_STATE || path.join(AUTH_DIR, 'candidate.json');
const COMPANY_STATE = process.env.COMPANY_STATE || path.join(AUTH_DIR, 'company.json');
const OUT_DIR = process.env.OUT_DIR || '/Users/xavibocanegra/VERIJOB/verijob-app/demo-clips';

const CANDIDATE_TOKEN =
  process.env.CANDIDATE_PUBLIC_TOKEN ||
  process.env.PUBLIC_TOKEN ||
  '';

const COMPANY_OPEN_TOKEN =
  process.env.COMPANY_OPEN_TOKEN ||
  process.env.PUBLIC_TOKEN ||
  '';

const VIEWPORT = { width: 1600, height: 1000 };
const RECORD_SIZE = { width: 1600, height: 1000 };
const SLOW = Number(process.env.SLOW_MS || 150);

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function stepPause(page, ms = 1200) {
  await page.waitForTimeout(ms);
}

async function humanMove(page, selector) {
  const el = page.locator(selector).first();
  if (await el.count()) {
    await el.hover({ timeout: 5000 });
    await page.waitForTimeout(500);
  }
}

async function safeClick(page, selectors) {
  for (const selector of selectors) {
    const el = page.locator(selector).first();
    if (await el.count()) {
      try {
        await el.click({ timeout: 5000 });
        return true;
      } catch {}
    }
  }
  return false;
}

async function closeContext(context) {
  const video = context.pages()[0]?.video?.();
  await context.close();
  return video;
}

async function saveVideo(video, targetPath) {
  if (!video) return;
  await ensureDir(path.dirname(targetPath));
  const src = await video.path();
  await fs.copyFile(src, targetPath);
}

async function newContext(browser, storageStatePath, clipName) {
  const clipDir = path.join(OUT_DIR, '_raw', clipName);
  await ensureDir(clipDir);

  return browser.newContext({
    storageState: storageStatePath,
    viewport: VIEWPORT,
    recordVideo: {
      dir: clipDir,
      size: RECORD_SIZE,
    },
  });
}

async function recordCandidateOverview(browser) {
  const name = '01-candidate-overview.webm';
  const context = await newContext(browser, CANDIDATE_STATE, 'candidate-overview');
  const page = await context.newPage();
  await page.goto(`${APP_URL}/candidate/overview`, { waitUntil: 'networkidle' });
  await stepPause(page, 1800);

  await humanMove(page, 'text=Nivel de confianza');
  await stepPause(page, 1200);

  const video = await closeContext(context);
  await saveVideo(video, path.join(OUT_DIR, name));
}

async function recordCandidateOverviewActions(browser) {
  const name = '02-candidate-overview-actions.webm';
  const context = await newContext(browser, CANDIDATE_STATE, 'candidate-overview-actions');
  const page = await context.newPage();
  await page.goto(`${APP_URL}/candidate/overview`, { waitUntil: 'networkidle' });
  await stepPause(page, 1500);

  await humanMove(page, 'text=Subir evidencia');
  await stepPause(page, 900);
  await humanMove(page, 'text=Solicitar verificación');
  await stepPause(page, 900);
  await humanMove(page, 'text=Completar perfil');
  await stepPause(page, 1000);

  const video = await closeContext(context);
  await saveVideo(video, path.join(OUT_DIR, name));
}

async function recordCandidateShare(browser) {
  const name = '03-candidate-share.webm';
  const context = await newContext(browser, CANDIDATE_STATE, 'candidate-share');
  const page = await context.newPage();
  await page.goto(`${APP_URL}/candidate/share`, { waitUntil: 'networkidle' });
  await stepPause(page, 1800);

  await humanMove(page, 'text=Copiar enlace público');
  await stepPause(page, 900);

  const token = CANDIDATE_TOKEN.trim();
  if (token) {
    await page.goto(`${APP_URL}/p/${token}`, { waitUntil: 'networkidle' });
    await stepPause(page, 1600);
  }

  const video = await closeContext(context);
  await saveVideo(video, path.join(OUT_DIR, name));
}

async function recordCompanyDashboard(browser) {
  const name = '04-company-dashboard.webm';
  const context = await newContext(browser, COMPANY_STATE, 'company-dashboard');
  const page = await context.newPage();
  await page.goto(`${APP_URL}/company`, { waitUntil: 'networkidle' });
  await stepPause(page, 1800);

  await humanMove(page, 'text=Candidatos para decidir');
  await stepPause(page, 1200);

  const video = await closeContext(context);
  await saveVideo(video, path.join(OUT_DIR, name));
}

async function recordCompanyCandidates(browser) {
  const name = '05-company-candidates.webm';
  const context = await newContext(browser, COMPANY_STATE, 'company-candidates');
  const page = await context.newPage();
  await page.goto(`${APP_URL}/company/candidates`, { waitUntil: 'networkidle' });
  await stepPause(page, 1800);

  await page.mouse.wheel(0, 500);
  await stepPause(page, 1000);

  await humanMove(page, 'text=Ver resumen');
  await stepPause(page, 900);

  const opened =
    await safeClick(page, [
      'text=Ver perfil completo (-1 acceso)',
      'text=Abrir perfil completo',
      'text=Ver perfil completo',
    ]);

  if (opened) {
    await stepPause(page, 1800);
  }

  const video = await closeContext(context);
  await saveVideo(video, path.join(OUT_DIR, name));
}

async function recordCompanyPublicUnlock(browser) {
  if (!COMPANY_OPEN_TOKEN.trim()) return;

  const name = '06-company-public-unlock.webm';
  const context = await newContext(browser, COMPANY_STATE, 'company-public-unlock');
  const page = await context.newPage();
  await page.goto(`${APP_URL}/p/${COMPANY_OPEN_TOKEN}`, { waitUntil: 'networkidle' });
  await stepPause(page, 1800);

  await humanMove(page, 'text=Ver perfil completo (-1 acceso)');
  await stepPause(page, 700);

  const clicked =
    await safeClick(page, [
      'text=Ver perfil completo (-1 acceso)',
      'text=Ver perfil completo',
      'text=Abrir perfil completo',
    ]);

  if (clicked) {
    await stepPause(page, 1800);
  }

  const video = await closeContext(context);
  await saveVideo(video, path.join(OUT_DIR, name));
}

async function main() {
  await ensureDir(OUT_DIR);

  const browser = await chromium.launch({
    headless: true,
    slowMo: SLOW,
  });

  try {
    await recordCandidateOverview(browser);
    await recordCandidateOverviewActions(browser);
    await recordCandidateShare(browser);
    await recordCompanyDashboard(browser);
    await recordCompanyCandidates(browser);
    await recordCompanyPublicUnlock(browser);
  } finally {
    await browser.close();
  }

  console.log(`OK_CLIPS=${OUT_DIR}`);
  console.log('FILES:');
  console.log('- 01-candidate-overview.webm');
  console.log('- 02-candidate-overview-actions.webm');
  console.log('- 03-candidate-share.webm');
  console.log('- 04-company-dashboard.webm');
  console.log('- 05-company-candidates.webm');
  console.log('- 06-company-public-unlock.webm (solo si pasas token)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
