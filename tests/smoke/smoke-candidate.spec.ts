import path from "path";
import { expect, test } from "@playwright/test";
import { createCandidateContext, ensureAuthenticatedActor } from "./helpers/auth";
import { requireSmokeEmail, smokeConfig } from "./helpers/smoke-config";

const validEvidencePath = path.resolve(process.cwd(), "tests/fixtures/evidence-valid.pdf");
const invalidEvidencePath = path.resolve(process.cwd(), "tests/fixtures/evidence-invalid.txt");

test.describe.serial("@candidate smoke candidate", () => {
  test("signup/login candidato, onboarding, experiencia, evidencia y verificaciones", async ({ browser }, testInfo) => {
    requireSmokeEmail(smokeConfig.candidate.email, "SMOKE_CANDIDATE_EMAIL");
    const actor = await createCandidateContext(browser);
    const { page } = actor;

    try {
      await ensureAuthenticatedActor(page, testInfo, "candidate", {
        next: "/candidate/overview",
      });

      if (/\/onboarding(\/)?$/.test(page.url())) {
        await expect(page.getByRole("heading", { name: /construye tu perfil profesional/i })).toBeVisible();
        await page.getByRole("button", { name: /añadir experiencia manualmente/i }).click();
      }

      await page.goto("/candidate/experience?new=1#manual-experience");

      await expect(page).toHaveURL(/\/candidate\/experience/);
      const manualExperienceSection = page.locator("#manual-experience");
      await expect(manualExperienceSection.getByLabel("Puesto")).toBeVisible();
      await expect(
        manualExperienceSection.getByRole("button", { name: /guardar experiencia/i })
      ).toBeVisible();

      await manualExperienceSection.getByLabel("Puesto").fill(smokeConfig.candidateExperience.roleTitle);
      await manualExperienceSection.getByLabel("Empresa").fill(smokeConfig.candidateExperience.companyName);
      await manualExperienceSection.getByLabel("Fecha inicio").fill(smokeConfig.candidateExperience.startDate);
      await manualExperienceSection.getByLabel("Fecha fin").fill(smokeConfig.candidateExperience.endDate);
      await manualExperienceSection.getByLabel("Descripción breve").fill(smokeConfig.candidateExperience.description);
      await manualExperienceSection.getByRole("button", { name: /guardar experiencia/i }).click();

      await expect(
        manualExperienceSection.getByText(/experiencia guardada correctamente/i)
      ).toBeVisible();

      await page.goto("/candidate/profile");
      await expect(page).toHaveURL(/\/candidate\/profile/);
      await expect(page.getByLabel(/nombre|name/i).first()).toBeVisible();

      await page.goto("/candidate/evidence");
      await expect(page.getByText(/subir nueva documentación/i)).toBeVisible();
      await page.getByLabel("Tipo documental").selectOption({ index: 0 });

      const experienceSelect = page.getByLabel("Experiencia objetivo");
      if (await experienceSelect.isEnabled()) {
        await experienceSelect.selectOption({ index: 1 });
      }

      await page.getByLabel("Archivo").setInputFiles(validEvidencePath);
      await page.getByRole("button", { name: /subir documentación/i }).click();
      await expect(
        page.getByText(/documento recibido|en análisis|pendiente de revisión/i).first()
      ).toBeVisible({ timeout: 25_000 });

      await page.getByLabel("Archivo").setInputFiles(invalidEvidencePath);
      await expect(page.getByText(/no es compatible|admite solo|formato/i)).toBeVisible();

      await page.goto("/candidate/verifications");
      await expect(page).toHaveURL(/\/candidate\/verifications/);
      await expect(page.locator("main")).toContainText(/verific/i);

      await page.goto("/candidate/experience");

      const firstExperienceCard = page.locator("article").first();

      await firstExperienceCard.getByPlaceholder("rrhh@empresa.com").fill(
        smokeConfig.candidateVerification.verifierEmail
      );

      await firstExperienceCard.getByRole("button", { name: /enviar solicitud/i }).click();

      await expect(
        firstExperienceCard.getByText(/solicitud enviada correctamente|solicitud activa|validación en curso reutilizada/i)
      ).toBeVisible({ timeout: 20_000 });

    } finally {
      await actor.close();
    }
  });
});
