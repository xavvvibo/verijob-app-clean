import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "@playwright/test";
import { APP_URL, AUTH_DIR } from "./_shared.mjs";

const OUT_DIR = process.env.OUT_DIR || path.join(process.cwd(), "demo-clips-v2");
const RAW_DIR = path.join(os.tmpdir(), "verijob-demo-clips-v2-raw");
const CANDIDATE_STATE = process.env.CANDIDATE_STATE || path.join(AUTH_DIR, "candidate-demo.json");
const COMPANY_STATE = process.env.COMPANY_STATE || path.join(AUTH_DIR, "company-demo.json");
const PUBLIC_TOKEN =
  process.env.PUBLIC_TOKEN ||
  process.env.CANDIDATE_PUBLIC_TOKEN ||
  "104f2a7249004b1b223d5a1189b866a20a2e9f316ced1147";

const VIEWPORT = { width: 1440, height: 900 };
const RECORD_SIZE = { width: 1440, height: 900 };
const PAGE_ZOOM = Number(process.env.PAGE_ZOOM || 1.1);
const SLOW_MS = Number(process.env.SLOW_MS || 90);

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function cleanupDir(dir) {
  await fs.rm(dir, { recursive: true, force: true }).catch(() => null);
}

async function pause(page, ms) {
  await page.waitForTimeout(ms);
}

async function applyFraming(page) {
  await page.addStyleTag({
    content: `
      html { zoom: ${PAGE_ZOOM}; }
      body { overflow-x: hidden !important; }
      ::-webkit-scrollbar { width: 0 !important; height: 0 !important; }
    `,
  }).catch(() => null);

  await page.evaluate((zoom) => {
    document.documentElement.style.zoom = String(zoom);
    document.body.style.overflowX = "hidden";
  }, PAGE_ZOOM).catch(() => null);
}

async function hoverFirst(page, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) === 0) continue;
    const visible = await locator.isVisible().catch(() => false);
    if (!visible) continue;
    await locator.hover({ timeout: 4_000 }).catch(() => null);
    return true;
  }
  return false;
}

async function clickFirst(page, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) === 0) continue;
    const visible = await locator.isVisible().catch(() => false);
    if (!visible) continue;
    await locator.click({ timeout: 4_000 }).catch(() => null);
    return true;
  }
  return false;
}

async function shortScroll(page, amount = 260) {
  await page.mouse.wheel(0, amount).catch(() => null);
}

async function newRecordedContext(browser, storageStatePath, clipKey) {
  const clipRawDir = path.join(RAW_DIR, clipKey);
  await ensureDir(clipRawDir);

  return browser.newContext({
    storageState: storageStatePath,
    viewport: VIEWPORT,
    recordVideo: {
      dir: clipRawDir,
      size: RECORD_SIZE,
    },
  });
}

async function finalizeClip(context, clipName) {
  const page = context.pages()[0];
  const video = page?.video?.();
  await context.close();
  if (!video) return;

  const sourcePath = await video.path();
  await ensureDir(OUT_DIR);
  await fs.copyFile(sourcePath, path.join(OUT_DIR, clipName));
}

async function runClip(browser, config) {
  const context = await newRecordedContext(browser, config.storageStatePath, config.key);
  const page = await context.newPage();
  const startedAt = Date.now();

  try {
    await page.goto(`${APP_URL}${config.route}`, { waitUntil: "domcontentloaded" });
    await applyFraming(page);
    await pause(page, config.initialPauseMs ?? 1500);
    if (typeof config.perform === "function") {
      await config.perform(page);
    }

    const elapsed = Date.now() - startedAt;
    const remaining = Math.max(0, config.durationMs - elapsed);
    if (remaining > 0) {
      await pause(page, remaining);
    }
  } finally {
    await finalizeClip(context, config.fileName);
  }
}

async function recordProblemCandidateOverview(browser) {
  await runClip(browser, {
    key: "problem-candidate-overview",
    fileName: "01-problem-candidate-overview.webm",
    storageStatePath: CANDIDATE_STATE,
    route: "/candidate/overview",
    durationMs: 7_500,
    initialPauseMs: 1_700,
    perform: async (page) => {
      await hoverFirst(page, ["text=Nivel de confianza", "text=Trust score", "text=Tu perfil en una mirada"]);
      await pause(page, 1_700);
      await hoverFirst(page, ["text=Tus experiencias", "text=Experiencia", "text=Subir evidencia"]);
      await pause(page, 1_300);
    },
  });
}

async function recordProblemCompanyRequests(browser) {
  await runClip(browser, {
    key: "problem-company-requests",
    fileName: "02-problem-company-requests.webm",
    storageStatePath: COMPANY_STATE,
    route: "/company/requests",
    durationMs: 6_500,
    initialPauseMs: 1_500,
    perform: async (page) => {
      await hoverFirst(page, ["text=Pendientes", "text=Solicitudes", "text=Resolver pendientes"]);
      await pause(page, 1_200);
      await shortScroll(page, 180);
      await pause(page, 900);
      await hoverFirst(page, ["text=Recientes", "text=Evidencias", "text=Resueltas"]);
      await pause(page, 1_000);
    },
  });
}

async function recordValidationCandidateEvidence(browser) {
  await runClip(browser, {
    key: "validation-candidate-evidence",
    fileName: "03-validation-candidate-evidence.webm",
    storageStatePath: CANDIDATE_STATE,
    route: "/candidate/evidence",
    durationMs: 8_000,
    initialPauseMs: 1_600,
    perform: async (page) => {
      await hoverFirst(page, ["text=Tipo documental", "text=Subir documentación", "text=Archivo"]);
      await pause(page, 1_300);
      await hoverFirst(page, ["text=Experiencia objetivo", "text=Documento recibido", "text=No hay evidencias registradas"]);
      await pause(page, 1_500);
      await shortScroll(page, 140);
      await pause(page, 900);
    },
  });
}

async function recordDecisionCompanyCandidates(browser) {
  await runClip(browser, {
    key: "decision-company-candidates",
    fileName: "04-decision-company-candidates.webm",
    storageStatePath: COMPANY_STATE,
    route: "/company/candidates",
    durationMs: 10_000,
    initialPauseMs: 1_700,
    perform: async (page) => {
      await hoverFirst(page, ["text=Candidatos para decidir", "text=Ver resumen", "text=Trust"]);
      await pause(page, 1_500);
      await hoverFirst(page, ["text=Ver perfil completo (-1 acceso)", "text=Abrir perfil completo", "text=Ver perfil completo"]);
      await pause(page, 1_400);
      await shortScroll(page, 180);
      await pause(page, 900);
      await hoverFirst(page, ["text=Más acciones", "text=Ver resumen", "text=Sin accesos disponibles"]);
      await pause(page, 1_300);
    },
  });
}

async function recordWowCompanyPublicAccess(browser) {
  if (!PUBLIC_TOKEN) {
    console.warn("[demo-clips-v2] No hay PUBLIC_TOKEN. Se omite 05-wow-company-public-access.webm.");
    return;
  }

  await runClip(browser, {
    key: "wow-company-public-access",
    fileName: "05-wow-company-public-access.webm",
    storageStatePath: COMPANY_STATE,
    route: `/p/${PUBLIC_TOKEN}`,
    durationMs: 9_000,
    initialPauseMs: 1_700,
    perform: async (page) => {
      await hoverFirst(page, ["text=Perfil verificable", "text=Ver perfil completo (-1 acceso)", "text=Nivel de confianza"]);
      await pause(page, 1_300);
      await clickFirst(page, ["text=Ver perfil completo (-1 acceso)", "text=Abrir perfil completo", "text=Ver perfil completo"]);
      await pause(page, 2_100);
      await hoverFirst(page, ["text=Habilidades", "text=Experiencia", "text=Trust"]);
      await pause(page, 1_000);
    },
  });
}

async function recordClosingCandidateShare(browser) {
  await runClip(browser, {
    key: "closing-candidate-share",
    fileName: "06-closing-candidate-share.webm",
    storageStatePath: CANDIDATE_STATE,
    route: "/candidate/share",
    durationMs: 7_000,
    initialPauseMs: 1_600,
    perform: async (page) => {
      await hoverFirst(page, ["text=Copiar enlace público", "text=Copiar enlace publico", "text=Perfil público"]);
      await pause(page, 1_400);
      await hoverFirst(page, ["text=Vista completa", "text=Vista pública resumida", "text=QR"]);
      await pause(page, 1_100);
    },
  });
}

async function main() {
  await ensureDir(OUT_DIR);
  await cleanupDir(RAW_DIR);
  await fs.access(CANDIDATE_STATE);
  await fs.access(COMPANY_STATE);

  const browser = await chromium.launch({
    headless: true,
    slowMo: SLOW_MS,
  });

  try {
    await recordProblemCandidateOverview(browser);
    await recordProblemCompanyRequests(browser);
    await recordValidationCandidateEvidence(browser);
    await recordDecisionCompanyCandidates(browser);
    await recordWowCompanyPublicAccess(browser);
    await recordClosingCandidateShare(browser);
    console.log(`OK_CLIPS=${OUT_DIR}`);
  } finally {
    await browser.close();
    await cleanupDir(RAW_DIR);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
