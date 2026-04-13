import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "@playwright/test";
import { APP_URL, AUTH_DIR } from "./_shared.mjs";

const OUT_DIR = process.env.OUT_DIR || path.join(process.cwd(), "demo-clips-guided");
const RAW_DIR = path.join(os.tmpdir(), "verijob-demo-guided-raw");
const CANDIDATE_STATE = process.env.CANDIDATE_STATE || path.join(AUTH_DIR, "candidate-demo.json");
const COMPANY_STATE = process.env.COMPANY_STATE || path.join(AUTH_DIR, "company-demo.json");
const PUBLIC_TOKEN =
  process.env.PUBLIC_TOKEN ||
  process.env.CANDIDATE_PUBLIC_TOKEN ||
  "ad1c60f9c234c1fb0c0835dfee65ebc8c76bb9004a6ab65f";

const VIEWPORT = { width: 1440, height: 900 };
const RECORD_SIZE = { width: 1440, height: 900 };
const PAGE_ZOOM = Number(process.env.PAGE_ZOOM || 1.04);
const SLOW_MS = Number(process.env.SLOW_MS || 70);
const SETTLE_MS = Number(process.env.SETTLE_MS || 1800);
const COOKIE_BUTTON_PATTERNS = [
  /aceptar todo/i,
  /aceptar/i,
  /acepto/i,
  /accept all/i,
  /accept/i,
];
const COOKIE_BANNER_SELECTORS = [
  '[id*="cookie" i]',
  '[class*="cookie" i]',
  '[id*="consent" i]',
  '[class*="consent" i]',
  '[aria-label*="cookie" i]',
  '[aria-label*="consent" i]',
  '[data-testid*="cookie" i]',
  '[data-testid*="consent" i]',
];

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
      html { zoom: ${PAGE_ZOOM}; scroll-behavior: smooth; }
      body { overflow-x: hidden !important; }
      * { cursor: none !important; }
      ::-webkit-scrollbar { width: 0 !important; height: 0 !important; }
    `,
  }).catch(() => null);

  await page.evaluate((zoom) => {
    document.documentElement.style.zoom = String(zoom);
    document.documentElement.style.scrollBehavior = "smooth";
    document.body.style.overflowX = "hidden";
    const styleId = "__verijob_demo_cleanups__";
    let style = document.getElementById(styleId);
    if (!style) {
      style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        * { cursor: none !important; }
        [id*="cookie" i],
        [class*="cookie" i],
        [id*="consent" i],
        [class*="consent" i],
        [data-testid*="cookie" i],
        [data-testid*="consent" i],
        [aria-label*="cookie" i],
        [aria-label*="consent" i] {
          transition: opacity 120ms ease;
        }
      `;
      document.head.appendChild(style);
    }
  }, PAGE_ZOOM).catch(() => null);
}

async function assertNoLoginRedirect(page, route) {
  const pathname = new URL(page.url()).pathname;
  if (pathname.startsWith("/login")) {
    throw new Error(`Ruta bloqueada por login: ${route}`);
  }
}

async function gotoStable(page, route) {
  await page.goto(`${APP_URL}${route}`, { waitUntil: "networkidle" });
  await assertNoLoginRedirect(page, route);
  await applyFraming(page);
  await assertCookieBannerGone(page, route);
}

async function moveMouseSmooth(page) {
  await page.mouse.move(420, 220, { steps: 16 }).catch(() => null);
  await pause(page, 250);
  await page.mouse.move(760, 260, { steps: 18 }).catch(() => null);
}

async function smoothScroll(page, y = 240) {
  await page.evaluate(async (distance) => {
    window.scrollBy({ top: distance, behavior: "smooth" });
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }, y).catch(() => null);
}

async function hoverText(page, regexes = []) {
  for (const pattern of regexes) {
    const locator = page.getByText(pattern, { exact: false }).first();
    const visible = await locator.isVisible().catch(() => false);
    if (!visible) continue;
    await locator.hover({ timeout: 4_000 }).catch(() => null);
    return true;
  }
  return false;
}

async function isCookieBannerVisible(page) {
  for (const selector of COOKIE_BANNER_SELECTORS) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) return true;
  }

  const cookieTextVisible = await page
    .getByText(/cookies|consentimiento|consent/i, { exact: false })
    .first()
    .isVisible()
    .catch(() => false);
  return cookieTextVisible;
}

async function tryClickCookieConsent(page) {
  for (const pattern of COOKIE_BUTTON_PATTERNS) {
    const roleButton = page.getByRole("button", { name: pattern }).first();
    if (await roleButton.isVisible().catch(() => false)) {
      await roleButton.click({ timeout: 3_000 }).catch(() => null);
      await pause(page, 800);
      if (!(await isCookieBannerVisible(page))) return true;
    }

    const buttonText = page.getByText(pattern, { exact: false }).first();
    if (await buttonText.isVisible().catch(() => false)) {
      await buttonText.click({ timeout: 3_000 }).catch(() => null);
      await pause(page, 800);
      if (!(await isCookieBannerVisible(page))) return true;
    }
  }

  for (const selector of [
    '[id*="cookie" i] button',
    '[class*="cookie" i] button',
    '[id*="consent" i] button',
    '[class*="consent" i] button',
  ]) {
    const button = page.locator(selector).filter({ hasText: /acept|accept/i }).first();
    if (await button.isVisible().catch(() => false)) {
      await button.click({ timeout: 3_000 }).catch(() => null);
      await pause(page, 800);
      if (!(await isCookieBannerVisible(page))) return true;
    }
  }

  return false;
}

async function setCookieConsentFallback(page) {
  await page.goto(APP_URL, { waitUntil: "domcontentloaded" }).catch(() => null);
  await page.evaluate(() => {
    const consentEntries = [
      ["cookie_consent", "accepted"],
      ["cookieConsent", "accepted"],
      ["cookiesAccepted", "true"],
      ["cookies_consent", "true"],
      ["consent", "accepted"],
      ["consent_status", "accepted"],
      ["gdpr_consent", "accepted"],
    ];

    for (const [key, value] of consentEntries) {
      try {
        window.localStorage.setItem(key, value);
      } catch {}
      try {
        window.sessionStorage.setItem(key, value);
      } catch {}
      try {
        document.cookie = `${key}=${value}; path=/; max-age=31536000; SameSite=Lax`;
      } catch {}
    }
  }).catch(() => null);
}

async function hideResidualCookieUi(page) {
  await page.evaluate(() => {
    const selectors = [
      '[id*="cookie" i]',
      '[class*="cookie" i]',
      '[id*="consent" i]',
      '[class*="consent" i]',
      '[data-testid*="cookie" i]',
      '[data-testid*="consent" i]',
      '[aria-label*="cookie" i]',
      '[aria-label*="consent" i]',
    ];

    for (const selector of selectors) {
      for (const node of document.querySelectorAll(selector)) {
        if (!(node instanceof HTMLElement)) continue;
        node.style.setProperty("display", "none", "important");
        node.style.setProperty("visibility", "hidden", "important");
        node.style.setProperty("opacity", "0", "important");
        node.style.setProperty("pointer-events", "none", "important");
      }
    }
  }).catch(() => null);
}

async function assertCookieBannerGone(page, route) {
  await hideResidualCookieUi(page);
  if (await isCookieBannerVisible(page)) {
    throw new Error(`Banner de cookies visible en ${route}`);
  }
}

async function prepareConsentState(browser, storageStatePath) {
  const context = await browser.newContext({
    storageState: storageStatePath || undefined,
    viewport: VIEWPORT,
  });
  const page = await context.newPage();

  try {
    await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
    await pause(page, 900);

    if (await isCookieBannerVisible(page)) {
      const clicked = await tryClickCookieConsent(page);
      if (!clicked && (await isCookieBannerVisible(page))) {
        await setCookieConsentFallback(page);
        await page.reload({ waitUntil: "domcontentloaded" }).catch(() => null);
      }
    }

    await hideResidualCookieUi(page);
    const preparedState = await context.storageState();
    return preparedState;
  } finally {
    await context.close().catch(() => null);
  }
}

async function newRecordedContext(browser, storageState, clipKey) {
  const clipRawDir = path.join(RAW_DIR, clipKey);
  await ensureDir(clipRawDir);

  return browser.newContext({
    storageState,
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
  if (!video) return null;

  const sourcePath = await video.path();
  await ensureDir(OUT_DIR);
  const targetPath = path.join(OUT_DIR, clipName);
  await fs.copyFile(sourcePath, targetPath);
  return targetPath;
}

async function runClip(browser, config) {
  const context = config.public
    ? await newRecordedContext(browser, config.preparedState, config.key)
    : await newRecordedContext(browser, config.preparedState, config.key);
  const page = await context.newPage();
  const startedAt = Date.now();

  try {
    await gotoStable(page, config.route);
    await pause(page, config.initialPauseMs ?? SETTLE_MS);
    await moveMouseSmooth(page);
    if (typeof config.perform === "function") {
      await config.perform(page);
    }
    const elapsed = Date.now() - startedAt;
    const remaining = Math.max(0, config.durationMs - elapsed);
    if (remaining > 0) {
      await pause(page, remaining);
    }
  } finally {
    return finalizeClip(context, config.fileName);
  }
}

async function recordCandidateOverview(browser) {
  return runClip(browser, {
    key: "candidate-overview",
    fileName: "01-candidate-overview.webm",
    preparedState: browser.__verijobCandidatePreparedState,
    route: "/candidate/overview",
    durationMs: 9_000,
    perform: async (page) => {
      await hoverText(page, [/trust score/i, /nivel de confianza/i, /tu perfil/i]);
      await pause(page, 1200);
      await smoothScroll(page, 180);
      await pause(page, 1200);
    },
  });
}

async function recordCandidateShare(browser) {
  return runClip(browser, {
    key: "candidate-share",
    fileName: "02-candidate-share.webm",
    preparedState: browser.__verijobCandidatePreparedState,
    route: "/candidate/share",
    durationMs: 7_000,
    perform: async (page) => {
      await hoverText(page, [/perfil p[úu]blico/i, /copiar enlace/i, /vista p[úu]blica/i]);
      await pause(page, 1200);
    },
  });
}

async function recordPublicProfile(browser) {
  return runClip(browser, {
    key: "public-profile",
    fileName: "03-public-profile.webm",
    preparedState: browser.__verijobPublicPreparedState,
    route: `/p/${PUBLIC_TOKEN}`,
    durationMs: 9_000,
    perform: async (page) => {
      await hoverText(page, [/perfil verificable/i, /nivel de confianza/i, /experiencias registradas/i]);
      await pause(page, 1100);
      await smoothScroll(page, 200);
      await pause(page, 1000);
    },
  });
}

async function recordCompanyDashboard(browser) {
  return runClip(browser, {
    key: "company-dashboard",
    fileName: "04-company-dashboard.webm",
    preparedState: browser.__verijobCompanyPreparedState,
    route: "/company",
    durationMs: 7_000,
    perform: async (page) => {
      await hoverText(page, [/candidatos para decidir/i, /revisar solicitudes/i, /dashboard/i]);
      await pause(page, 1200);
    },
  });
}

async function recordCompanyCandidates(browser) {
  return runClip(browser, {
    key: "company-candidates",
    fileName: "05-company-candidates.webm",
    preparedState: browser.__verijobCompanyPreparedState,
    route: "/company/candidates",
    durationMs: 7_000,
    perform: async (page) => {
      await hoverText(page, [/candidatos para decidir/i, /lucia torres vega/i, /ver resumen/i]);
      await pause(page, 1200);
      await smoothScroll(page, 160);
      await pause(page, 900);
    },
  });
}

async function recordCompanyCandidateDetail(browser) {
  return runClip(browser, {
    key: "company-candidate-detail",
    fileName: "06-company-candidate-detail.webm",
    preparedState: browser.__verijobCompanyPreparedState,
    route: `/company/candidate/${PUBLIC_TOKEN}`,
    durationMs: 11_000,
    perform: async (page) => {
      await hoverText(page, [/lucia torres vega/i, /perfil desbloqueado/i, /ver perfil completo/i, /resumen/i]);
      await pause(page, 1300);
      await smoothScroll(page, 220);
      await pause(page, 1200);
      await smoothScroll(page, -120);
      await pause(page, 900);
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
    browser.__verijobCandidatePreparedState = await prepareConsentState(browser, CANDIDATE_STATE);
    browser.__verijobCompanyPreparedState = await prepareConsentState(browser, COMPANY_STATE);
    browser.__verijobPublicPreparedState = await prepareConsentState(browser, undefined);

    const clips = [];
    clips.push(await recordCandidateOverview(browser));
    clips.push(await recordCandidateShare(browser));
    clips.push(await recordPublicProfile(browser));
    clips.push(await recordCompanyDashboard(browser));
    clips.push(await recordCompanyCandidates(browser));
    clips.push(await recordCompanyCandidateDetail(browser));
    console.log(`OK_CLIPS=${OUT_DIR}`);
    for (const clip of clips.filter(Boolean)) {
      console.log(`CLIP=${clip}`);
    }
  } finally {
    await browser.close();
    await cleanupDir(RAW_DIR);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
