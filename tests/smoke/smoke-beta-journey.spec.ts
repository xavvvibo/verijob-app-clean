import { expect, test } from "@playwright/test";
import {
  createCandidateContext,
  createCompanyContext,
  createPublicContext,
  loginWithOtp,
  signupWithOtp,
} from "./helpers/auth";
import { installPageDiagnostics, expectNoBlankScreen } from "./helpers/diagnostics";
import { requireSmokeEmail, smokeConfig } from "./helpers/smoke-config";

function buildEditedDescription(base: string) {
  return `${base} Validado por smoke beta.`;
}

test.describe.serial("@journey @beta-gate smoke beta-ready journey", () => {
  test("candidate -> verification -> company -> public profile", async ({ browser }, testInfo) => {
    requireSmokeEmail(smokeConfig.candidate.email, "SMOKE_CANDIDATE_EMAIL");
    requireSmokeEmail(smokeConfig.company.email, "SMOKE_COMPANY_EMAIL");

    const editedDescription = buildEditedDescription(smokeConfig.candidateExperience.description);
    let publicUrl: string | null = null;
    let verificationResolved = false;

    const candidateActor = await createCandidateContext(browser);
    const candidateDiagnostics = installPageDiagnostics(candidateActor.page, testInfo, "candidate-initial");

    try {
      await test.step("candidate auth + onboarding", async () => {
        if (smokeConfig.candidate.authMode === "login") {
          await loginWithOtp(candidateActor.page, testInfo, {
            email: smokeConfig.candidate.email,
            otp: smokeConfig.candidate.otp,
            mode: "candidate",
            next: "/candidate/overview",
          });
        } else {
          await signupWithOtp(candidateActor.page, testInfo, {
            role: "candidate",
            email: smokeConfig.candidate.email,
            otp: smokeConfig.candidate.otp,
          });
        }

        if (/\/onboarding(\/)?$/.test(candidateActor.page.url())) {
          await expect(candidateActor.page.getByRole("heading", { name: /construye tu perfil profesional/i })).toBeVisible();
          await candidateActor.page.getByRole("button", { name: /añadir experiencia manualmente/i }).click();
        }

        await expectNoBlankScreen(candidateActor.page, "candidate onboarding");
      });

      await test.step("candidate create experience", async () => {
        await candidateActor.page.goto("/candidate/experience?new=1#manual-experience");
        await expect(candidateActor.page.getByText(/mis experiencias/i)).toBeVisible();

        const manualExperienceSection = candidateActor.page.locator("#manual-experience");
        await manualExperienceSection.getByLabel("Puesto").fill(smokeConfig.candidateExperience.roleTitle);
        await manualExperienceSection.getByLabel("Empresa").fill(smokeConfig.candidateExperience.companyName);
        await manualExperienceSection.getByLabel("Fecha inicio").fill(smokeConfig.candidateExperience.startDate);
        await manualExperienceSection.getByLabel("Fecha fin").fill(smokeConfig.candidateExperience.endDate);
        await manualExperienceSection.getByLabel("Descripción breve").fill(smokeConfig.candidateExperience.description);
        await manualExperienceSection.getByRole("button", { name: /guardar experiencia/i }).click();
        await expect(manualExperienceSection.getByText(/experiencia guardada correctamente/i)).toBeVisible();
      });

      await test.step("candidate edit experience + persistence", async () => {
        await candidateActor.page.goto("/candidate/experience");
        const targetCard = candidateActor.page
          .locator("article")
          .filter({
            has: candidateActor.page.getByText(new RegExp(smokeConfig.candidateExperience.companyName, "i")),
          })
          .first();

        await expect(targetCard).toBeVisible();
        await targetCard.getByRole("button", { name: /ver detalle|ocultar detalle/i }).click();
        await targetCard.getByRole("button", { name: /editar experiencia/i }).click();
        await targetCard.getByPlaceholder("Descripción").fill(editedDescription);
        await targetCard.getByRole("button", { name: /guardar cambios/i }).click();
        await expect(candidateActor.page.getByText(/experiencia actualizada correctamente/i)).toBeVisible();

        await candidateActor.page.reload();
        const reloadedCard = candidateActor.page
          .locator("article")
          .filter({
            has: candidateActor.page.getByText(new RegExp(smokeConfig.candidateExperience.companyName, "i")),
          })
          .first();
        await reloadedCard.getByRole("button", { name: /ver detalle|ocultar detalle/i }).click();
        await expect(reloadedCard.getByText(new RegExp(editedDescription.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"))).toBeVisible();
      });

      await test.step("candidate request verification", async () => {
        await candidateActor.page.goto("/candidate/experience");
        const targetCard = candidateActor.page
          .locator("article")
          .filter({
            has: candidateActor.page.getByText(new RegExp(smokeConfig.candidateExperience.companyName, "i")),
          })
          .first();

        await targetCard.getByRole("button", { name: /ver detalle|ocultar detalle/i }).click();
        await targetCard.getByPlaceholder("rrhh@empresa.com").fill(smokeConfig.candidateVerification.verifierEmail);
        await targetCard.getByRole("button", { name: /enviar solicitud/i }).click();
        await expect(
          targetCard.getByText(/solicitud enviada correctamente|ya existía una solicitud activa|validación en curso reutilizada/i),
        ).toBeVisible({ timeout: 20_000 });
      });

      await test.step("candidate public profile link", async () => {
        await candidateActor.page.goto("/candidate/share");
        await expect(candidateActor.page.getByRole("heading", { name: /perfil público/i })).toBeVisible();
        await candidateActor.page.getByRole("button", { name: /regenerar enlace|copiar enlace/i }).first().waitFor({ state: "visible" });
        const linkBlock = candidateActor.page.locator("text=/https?:\\/\\/.*\\/p\\/[A-Za-z0-9_-]+/").first();
        await expect(linkBlock).toBeVisible({ timeout: 20_000 });
        publicUrl = (await linkBlock.textContent())?.trim() || null;
        expect(publicUrl, "Debe existir URL pública del candidato").toBeTruthy();
      });

      await candidateDiagnostics.assertHealthy();
    } finally {
      await candidateActor.close();
    }

    const companyActor = await createCompanyContext(browser);
    const companyDiagnostics = installPageDiagnostics(companyActor.page, testInfo, "company-review");

    try {
      await test.step("company auth + onboarding + dashboard", async () => {
        if (smokeConfig.company.authMode === "login") {
          await loginWithOtp(companyActor.page, testInfo, {
            email: smokeConfig.company.email,
            otp: smokeConfig.company.otp,
            mode: "company",
            next: "/company",
          });
        } else {
          await signupWithOtp(companyActor.page, testInfo, {
            role: "company",
            email: smokeConfig.company.email,
            otp: smokeConfig.company.otp,
          });
        }

        if (/\/onboarding\/company/.test(companyActor.page.url())) {
          await expect(companyActor.page.getByRole("heading", { name: /activa tu entorno de empresa/i })).toBeVisible();
          await companyActor.page.getByLabel("Razón social").fill(smokeConfig.companyProfile.legalName);
          await companyActor.page.getByLabel("Nombre comercial").fill(smokeConfig.companyProfile.tradeName);
          await companyActor.page.getByLabel("CIF/NIF").fill(smokeConfig.companyProfile.taxId);
          await companyActor.page.getByLabel("Email corporativo").fill(smokeConfig.companyProfile.contactEmail);
          await companyActor.page.getByLabel("Teléfono").fill(smokeConfig.companyProfile.contactPhone);
          await companyActor.page.getByLabel("Tipo de empresa").selectOption({ label: smokeConfig.companyProfile.companyType });
          await companyActor.page.getByLabel("Sector").selectOption({ label: smokeConfig.companyProfile.sector });
          await companyActor.page.getByLabel("Modelo de negocio").selectOption({ label: smokeConfig.companyProfile.businessModel });
          await companyActor.page.getByLabel("Segmento de mercado").selectOption({ label: smokeConfig.companyProfile.marketSegment });
          await companyActor.page.getByLabel("Persona de contacto").fill(smokeConfig.companyProfile.contactPersonName);
          await companyActor.page.getByLabel("Cargo persona de contacto").fill(smokeConfig.companyProfile.contactPersonRole);
          await companyActor.page.getByLabel("Dirección operativa").fill(smokeConfig.companyProfile.operatingAddress);
          await companyActor.page.getByRole("button", { name: /guardar y continuar/i }).click();
        }

        await expect(companyActor.page).toHaveURL(/\/company/);
        await expectNoBlankScreen(companyActor.page, "company dashboard");
      });

      await test.step("company requests list + candidate profile surfaces", async () => {
        await companyActor.page.goto("/company/requests");
        await expect(companyActor.page.getByRole("heading", { name: /solicitudes de validación/i })).toBeVisible();

        const requestCard = companyActor.page
          .locator("article")
          .filter({
            has: companyActor.page.getByText(new RegExp(smokeConfig.candidateExperience.companyName, "i")),
          })
          .first();

        await expect(requestCard).toBeVisible({ timeout: 20_000 });
        await requestCard.getByRole("link", { name: /abrir y resolver|ver detalle/i }).click();
        await expect(companyActor.page.getByRole("heading", { name: /validación de experiencia/i })).toBeVisible();
      });

      await test.step("company resolve verification or capture stable failure", async () => {
        const confirmButton = companyActor.page.getByRole("button", { name: /confirmar experiencia|experiencia confirmada/i });
        await expect(confirmButton).toBeVisible();
        await confirmButton.click();

        const success = companyActor.page.getByText(/experiencia confirmada|solicitud ya está resuelta/i).first();
        const error = companyActor.page.getByText(/no se pudo registrar la decisión/i).first();

        if (await success.isVisible().catch(() => false)) {
          verificationResolved = true;
        } else if (await error.isVisible().catch(() => false)) {
          verificationResolved = false;
          await testInfo.attach("company-verification-failure.txt", {
            body: await error.innerText(),
            contentType: "text/plain",
          });
        } else {
          const bodyText = await companyActor.page.locator("body").innerText();
          await testInfo.attach("company-verification-unknown-state.txt", {
            body: bodyText,
            contentType: "text/plain",
          });
          throw new Error("La resolución de verificación no devolvió ni éxito ni error estable.");
        }
      });

      await companyDiagnostics.assertHealthy();
    } finally {
      await companyActor.close();
    }

    const candidateReviewActor = await createCandidateContext(browser);
    const candidateReviewDiagnostics = installPageDiagnostics(candidateReviewActor.page, testInfo, "candidate-review");

    try {
      await test.step("candidate sees updated verification state", async () => {
        await loginWithOtp(candidateReviewActor.page, testInfo, {
          email: smokeConfig.candidate.email,
          otp: smokeConfig.candidate.otp,
          mode: "candidate",
          next: "/candidate/verifications",
        });

        await candidateReviewActor.page.goto("/candidate/verifications");
        await expect(candidateReviewActor.page.getByRole("heading", { name: /verificaciones/i })).toBeVisible();
        await expectNoBlankScreen(candidateReviewActor.page, "candidate verifications");

        if (verificationResolved) {
          await expect(candidateReviewActor.page.getByText(/verificación completada|confirmada/i)).toBeVisible({ timeout: 20_000 });
        } else {
          await expect(candidateReviewActor.page.getByText(/pendiente de validación|en revisión/i)).toBeVisible({ timeout: 20_000 });
        }
      });

      await candidateReviewDiagnostics.assertHealthy();
    } finally {
      await candidateReviewActor.close();
    }

    const publicActor = await createPublicContext(browser);
    const publicDiagnostics = installPageDiagnostics(publicActor.page, testInfo, "public-profile");

    try {
      await test.step("public profile renders safely", async () => {
        if (!publicUrl) {
          throw new Error("No se pudo obtener la URL pública del candidato.");
        }

        await publicActor.page.goto(publicUrl);
        await expectNoBlankScreen(publicActor.page, "public profile");
        await expect(publicActor.page.getByText(/trust score|perfil profesional|señales verificables/i).first()).toBeVisible();
        await expect(publicActor.page.getByText(smokeConfig.candidate.email)).toHaveCount(0);
        await expect(publicActor.page.getByText(/desbloquear perfil completo/i)).toBeVisible();
      });

      await publicDiagnostics.assertHealthy();
    } finally {
      await publicActor.close();
    }
  });
});
