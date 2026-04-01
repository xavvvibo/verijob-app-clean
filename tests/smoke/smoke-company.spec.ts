import { expect, test } from "@playwright/test";
import { createCompanyContext, ensureAuthenticatedActor } from "./helpers/auth";
import { requireSmokeEmail, smokeConfig } from "./helpers/smoke-config";

test.describe.serial("@company smoke company", () => {
  test("signup/login empresa y completar onboarding", async ({ browser }, testInfo) => {
    requireSmokeEmail(smokeConfig.company.email, "SMOKE_COMPANY_EMAIL");
    const actor = await createCompanyContext(browser);
    const { page } = actor;

    try {
      await ensureAuthenticatedActor(page, testInfo, "company", {
        next: "/company",
      });

      if (/\/onboarding\/company/.test(page.url())) {
        await expect(page.getByRole("heading", { name: /activa tu entorno de empresa/i })).toBeVisible();
        await page.getByLabel("Razón social").fill(smokeConfig.companyProfile.legalName);
        await page.getByLabel("Nombre comercial").fill(smokeConfig.companyProfile.tradeName);
        await page.getByLabel("CIF/NIF").fill(smokeConfig.companyProfile.taxId);
        await page.getByLabel("Email corporativo").fill(smokeConfig.companyProfile.contactEmail);
        await page.getByLabel("Teléfono").fill(smokeConfig.companyProfile.contactPhone);
        await page.getByLabel("Tipo de empresa").selectOption({ label: smokeConfig.companyProfile.companyType });
        await page.getByLabel("Sector").selectOption({ label: smokeConfig.companyProfile.sector });
        await page.getByLabel("Modelo de negocio").selectOption({ label: smokeConfig.companyProfile.businessModel });
        await page.getByLabel("Segmento de mercado").selectOption({ label: smokeConfig.companyProfile.marketSegment });
        await page.getByLabel("Persona de contacto").fill(smokeConfig.companyProfile.contactPersonName);
        await page.getByLabel("Cargo persona de contacto").fill(smokeConfig.companyProfile.contactPersonRole);
        await page.getByLabel("Dirección operativa").fill(smokeConfig.companyProfile.operatingAddress);
        await page.getByRole("button", { name: /guardar y continuar/i }).click();
      }

      await expect(page).toHaveURL(/\/company/);
      await expect(page.getByRole("heading", { name: /panel|empresa|dashboard/i }).first()).toBeVisible();
      await page.goto("/company/profile");
      await expect(page.getByRole("heading", { name: /perfil/i })).toBeVisible();
    } finally {
      await actor.close();
    }
  });
});
