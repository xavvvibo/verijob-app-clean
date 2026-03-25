import { test, expect } from "@playwright/test";

const pause = (ms = 1200) => new Promise((r) => setTimeout(r, ms));

const APP_URL = "https://app.verijob.es";

test.describe.serial("@demo clean commercial", () => {
  test("demo limpia verijob (ritmo comercial)", async ({ browser }) => {
    test.setTimeout(10 * 60 * 1000);

    // =========================
    // CANDIDATO
    // =========================
    const candidateContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      recordVideo: {
        dir: "tests/demo/videos/candidate-clean",
        size: { width: 1440, height: 900 },
      },
    });

    const candidatePage = await candidateContext.newPage();

    try {
      console.log("Login candidato manual → rápido");
      await candidatePage.goto(`${APP_URL}/login`);
      await candidatePage.pause(); // OTP rápido

      await candidatePage.goto(`${APP_URL}/candidate/profile`);
      await pause(2000);

      await candidatePage.goto(`${APP_URL}/candidate/experience`);
      await pause(2000);

      await candidatePage.goto(`${APP_URL}/candidate/evidence`);
      await pause(2000);

      await candidatePage.goto(`${APP_URL}/candidate/share`);
      await pause(3000);
    } finally {
      await candidateContext.close();
    }

    // =========================
    // EMPRESA
    // =========================
    const companyContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      recordVideo: {
        dir: "tests/demo/videos/company-clean",
        size: { width: 1440, height: 900 },
      },
    });

    const companyPage = await companyContext.newPage();

    try {
      console.log("Login empresa manual → rápido");
      await companyPage.goto(`${APP_URL}/login`);
      await companyPage.pause(); // OTP rápido

      await companyPage.goto(`${APP_URL}/company/candidates`);
      await pause(3000);

      console.log("Aquí haces unlock manual y resumes");
      await companyPage.pause();

      await companyPage.goto(`${APP_URL}/company`);
      await pause(2000);
    } finally {
      await companyContext.close();
    }
  });
});
