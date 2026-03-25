import { expect, test } from "@playwright/test";
import { createCompanyContext, loginWithOtp } from "./helpers/auth";
import { requireSmokeEmail, smokeConfig } from "./helpers/smoke-config";

const publicToken = process.env.SMOKE_COMPANY_PUBLIC_TOKEN || "9b3383905a508e4de1f9700412e3559a07bd82e399c3989b";

test.describe.serial("@company @public-access smoke company public unlock", () => {
  test("empresa autenticada no cae en auth pública desde /p/[token]", async ({ browser }, testInfo) => {
    requireSmokeEmail(smokeConfig.company.email, "SMOKE_COMPANY_EMAIL");
    const actor = await createCompanyContext(browser);
    const { page } = actor;

    try {
      await loginWithOtp(page, testInfo, {
        email: smokeConfig.company.email,
        otp: smokeConfig.company.otp,
        mode: "company",
        next: "/company",
      });

      await page.goto(`/p/${publicToken}`);
      await expect(page).toHaveURL(new RegExp(`/p/${publicToken}$`));

      await expect
        .poll(async () => {
          const loginHref = await page.getByRole("link", { name: /^Acceso empresa$/i }).getAttribute("href").catch(() => null);
          const signupHref = await page.getByRole("link", { name: /^Desbloquear perfil completo$/i }).getAttribute("href").catch(() => null);
          const unlockVisible = await page.getByRole("button", { name: /^Desbloquear perfil completo$/i }).isVisible().catch(() => false);
          return JSON.stringify({ loginHref, signupHref, unlockVisible });
        })
        .toContain(`"unlockVisible":true`);

      await expect(page.getByRole("link", { name: /^Acceso empresa$/i })).toHaveAttribute(
        "href",
        new RegExp(`/company/candidate/${publicToken}$`),
      );
      await expect(page.getByRole("link", { name: /^Desbloquear perfil completo$/i })).toHaveCount(0);

      await page.getByRole("button", { name: /^Desbloquear perfil completo$/i }).click();
      await expect(page).not.toHaveURL(/\/(login|signup)/);
      await expect(page.getByText(/Desbloquear perfil completo/i)).toBeVisible();
    } finally {
      await actor.close();
    }
  });
});
