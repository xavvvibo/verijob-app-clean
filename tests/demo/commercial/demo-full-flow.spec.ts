import { test, expect } from "@playwright/test";

const pause = (ms = 1500) => new Promise((resolve) => setTimeout(resolve, ms));

const APP_URL = "https://app.verijob.es";
const CANDIDATE_VIDEO_DIR = "/Users/xavibocanegra/VERIJOB/verijob-app/tests/demo/videos/candidate";
const COMPANY_VIDEO_DIR = "/Users/xavibocanegra/VERIJOB/verijob-app/tests/demo/videos/company";

test.describe.serial("@demo commercial", () => {
  test("demo comercial verijob - candidato -> perfil publico -> empresa", async ({ browser }) => {
    test.setTimeout(30 * 60 * 1000);

    // ======================================================
    // 1) CANDIDATO
    // ======================================================
    const candidateContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      recordVideo: {
        dir: CANDIDATE_VIDEO_DIR,
        size: { width: 1440, height: 900 },
      },
    });

    const candidatePage = await candidateContext.newPage();

    try {
      console.log("[demo] Candidato: abre login y espera OTP manual");
      await candidatePage.goto(`${APP_URL}/login`, { waitUntil: "domcontentloaded" });
      await pause(2000);

      console.log("[demo] Mete OTP del candidato y pulsa Resume en Playwright");
      await candidatePage.pause();

      await candidatePage.goto(`${APP_URL}/candidate/profile`, { waitUntil: "domcontentloaded" });
      await expect(candidatePage).toHaveURL(/candidate\/profile/);
      await pause(2500);

      await candidatePage.goto(`${APP_URL}/candidate/experience`, { waitUntil: "domcontentloaded" });
      await expect(candidatePage).toHaveURL(/candidate\/experience/);
      await pause(2500);

      await candidatePage.goto(`${APP_URL}/candidate/evidence`, { waitUntil: "domcontentloaded" });
      await expect(candidatePage).toHaveURL(/candidate\/evidence/);
      await pause(2500);

      await candidatePage.goto(`${APP_URL}/candidate/verifications`, { waitUntil: "domcontentloaded" });
      await expect(candidatePage).toHaveURL(/candidate\/verifications/);
      await pause(2500);

      await candidatePage.goto(`${APP_URL}/candidate/share`, { waitUntil: "domcontentloaded" });
      await expect(candidatePage).toHaveURL(/candidate\/share/);
      await pause(4000);
    } finally {
      await candidateContext.close();
    }

    // ======================================================
    // 2) EMPRESA
    // ======================================================
    const companyContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      recordVideo: {
        dir: COMPANY_VIDEO_DIR,
        size: { width: 1440, height: 900 },
      },
    });

    const companyPage = await companyContext.newPage();

    try {
      console.log("[demo] Empresa: abre login y espera OTP manual");
      await companyPage.goto(`${APP_URL}/login`, { waitUntil: "domcontentloaded" });
      await pause(2000);

      console.log("[demo] IMPORTANTE: mete OTP de EMPRESA (no candidato) y pulsa Resume");
      await companyPage.pause();

      // ===== FIX CLAVE =====
      const currentUrl = companyPage.url();

      if (/candidate\/overview/.test(currentUrl)) {
        throw new Error(
          `Login incorrecto: estás dentro como candidato (${currentUrl}). ` +
          `Vuelve atrás y haz login con una cuenta de EMPRESA en este contexto.`
        );
      }

      await expect(companyPage).toHaveURL(/(company|onboarding)/, { timeout: 15000 });

      // DASHBOARD EMPRESA
      await companyPage.goto(`${APP_URL}/company`, { waitUntil: "domcontentloaded" });
      await expect(companyPage).toHaveURL(/company/);
      await pause(3000);

      // BASE DE CANDIDATOS
      await companyPage.goto(`${APP_URL}/company/candidates`, { waitUntil: "domcontentloaded" });
      await expect(companyPage).toHaveURL(/company\/candidates/);
      await pause(3000);

      console.log("[demo] Navega manualmente, abre candidato y haz unlock. Luego Resume.");
      await companyPage.pause();

      await companyPage.goto(`${APP_URL}/company`, { waitUntil: "domcontentloaded" });
      await pause(2500);
    } finally {
      await companyContext.close();
    }
  });
});
