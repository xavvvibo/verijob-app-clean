import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
import { APP_URL, AUTH_DIR, VIEWPORT, resolveCurrentUrl } from "./_shared.mjs";

const OUT_DIR = process.env.OUT_DIR || path.join(process.cwd(), "demo-clips");
const CANDIDATE_STATE = process.env.CANDIDATE_STATE || path.join(AUTH_DIR, "candidate-demo.json");
const COMPANY_STATE = process.env.COMPANY_STATE || path.join(AUTH_DIR, "company-demo.json");
const RECORD_SIZE = { width: 1600, height: 1000 };
const SLOW_MS = Number(process.env.SLOW_MS || 120);

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function stepPause(page, ms = 1200) {
  await page.waitForTimeout(ms);
}

async function hoverIfVisible(page, selector) {
  const locator = page.locator(selector).first();
  if ((await locator.count()) > 0) {
    await locator.hover({ timeout: 5_000 }).catch(() => null);
    await page.waitForTimeout(400);
    return true;
  }
  return false;
}

async function clickFirst(page, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) === 0) continue;
    try {
      await locator.click({ timeout: 5_000 });
      return true;
    } catch {}
  }
  return false;
}

async function newRecordedContext(browser, storageState, clipName) {
  const rawDir = path.join(OUT_DIR, "_raw", clipName);
  await ensureDir(rawDir);
  return browser.newContext({
    storageState,
    viewport: VIEWPORT,
    recordVideo: {
      dir: rawDir,
      size: RECORD_SIZE,
    },
  });
}

async function closeAndPersist(context, targetFile) {
  const page = context.pages()[0];
  const video = page?.video?.();
  await context.close();
  if (!video) return;
  const source = await video.path();
  await ensureDir(path.dirname(targetFile));
  await fs.copyFile(source, targetFile);
}

async function resolveCandidateToken(browser) {
  const context = await browser.newContext({ storageState: CANDIDATE_STATE, viewport: VIEWPORT });
  const page = await context.newPage();
  try {
    await page.goto(`${APP_URL}/candidate/share`, { waitUntil: "networkidle" });
    const response = await page.evaluate(async () => {
      const res = await fetch("/api/candidate/public-link", {
        method: "POST",
        credentials: "include",
      });
      return res.json().catch(() => ({}));
    });
    return String(response?.token || "");
  } finally {
    await context.close();
  }
}

async function recordCandidateOverview(browser) {
  const context = await newRecordedContext(browser, CANDIDATE_STATE, "candidate-overview");
  const page = await context.newPage();
  await page.goto(`${APP_URL}/candidate/overview`, { waitUntil: "networkidle" });
  await stepPause(page, 1800);
  await hoverIfVisible(page, "text=Nivel de confianza");
  await stepPause(page, 1100);
  await closeAndPersist(context, path.join(OUT_DIR, "01-candidate-overview.webm"));
}

async function recordCandidateShare(browser) {
  const context = await newRecordedContext(browser, CANDIDATE_STATE, "candidate-share");
  const page = await context.newPage();
  await page.goto(`${APP_URL}/candidate/share`, { waitUntil: "networkidle" });
  await stepPause(page, 1800);
  await hoverIfVisible(page, "text=Copiar enlace publico");
  await hoverIfVisible(page, "text=Vista completa");
  await stepPause(page, 1000);
  await closeAndPersist(context, path.join(OUT_DIR, "02-candidate-share.webm"));
}

async function recordCompanyDashboard(browser) {
  const context = await newRecordedContext(browser, COMPANY_STATE, "company-dashboard");
  const page = await context.newPage();
  await page.goto(`${APP_URL}/company`, { waitUntil: "networkidle" });
  await stepPause(page, 1800);
  await hoverIfVisible(page, "text=Candidatos para decidir");
  await stepPause(page, 1100);
  await closeAndPersist(context, path.join(OUT_DIR, "03-company-dashboard.webm"));
}

async function recordCompanyCandidates(browser) {
  const context = await newRecordedContext(browser, COMPANY_STATE, "company-candidates");
  const page = await context.newPage();
  await page.goto(`${APP_URL}/company/candidates`, { waitUntil: "networkidle" });
  await stepPause(page, 1800);
  await hoverIfVisible(page, "text=Ver resumen");
  await stepPause(page, 900);
  await clickFirst(page, [
    "text=Ver perfil completo (-1 acceso)",
    "text=Abrir perfil completo",
    "text=Ver perfil completo",
  ]);
  await stepPause(page, 1500);
  await closeAndPersist(context, path.join(OUT_DIR, "04-company-candidates.webm"));
}

async function recordCompanyPublicAccess(browser, token) {
  if (!token) return;

  const context = await newRecordedContext(browser, COMPANY_STATE, "company-public-access");
  const page = await context.newPage();
  await page.goto(`${APP_URL}/p/${token}`, { waitUntil: "networkidle" });
  await stepPause(page, 1800);
  await hoverIfVisible(page, "text=Ver perfil completo (-1 acceso)");
  await clickFirst(page, [
    "text=Ver perfil completo (-1 acceso)",
    "text=Abrir perfil completo",
    "text=Ver perfil completo",
  ]);
  await stepPause(page, 1800);
  const finalPath = await resolveCurrentUrl(page);
  await closeAndPersist(context, path.join(OUT_DIR, "05-company-public-access.webm"));
  console.log(`COMPANY_PUBLIC_ACCESS_FINAL=${finalPath}`);
}

async function main() {
  await ensureDir(OUT_DIR);
  await fs.access(CANDIDATE_STATE);
  await fs.access(COMPANY_STATE);

  const browser = await chromium.launch({
    headless: true,
    slowMo: SLOW_MS,
  });

  try {
    const token = await resolveCandidateToken(browser);
    await recordCandidateOverview(browser);
    await recordCandidateShare(browser);
    await recordCompanyDashboard(browser);
    await recordCompanyCandidates(browser);
    await recordCompanyPublicAccess(browser, token);
    console.log(`OK_CLIPS=${OUT_DIR}`);
    console.log(`CANDIDATE_PUBLIC_TOKEN=${token || "unavailable"}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
