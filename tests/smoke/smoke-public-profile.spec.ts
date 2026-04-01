import { expect, test } from "@playwright/test";
import { createCandidateContext, ensureAuthenticatedActor } from "./helpers/auth";
import { requireSmokeEmail, smokeConfig } from "./helpers/smoke-config";

test.describe.serial("@public-profile smoke public profile", () => {
  test("preview interna y perfil público renderizan", async ({ browser }, testInfo) => {
    requireSmokeEmail(smokeConfig.candidate.email, "SMOKE_CANDIDATE_EMAIL");
    const actor = await createCandidateContext(browser);
    const { page } = actor;

    try {
      await ensureAuthenticatedActor(page, testInfo, "candidate", {
        next: "/candidate/share",
      });

      await page.goto("/candidate/share");
      await expect(page.getByRole("heading", { name: /perfil público/i })).toBeVisible();
      await expect(page.getByText(/esta vista previa usa el mismo renderer real del perfil público/i)).toBeVisible();

      await page.getByRole("button", { name: /regenerar enlace|copiar enlace/i }).first().waitFor({ state: "visible" });
      const linkBlock = page.locator("text=/https?:\\/\\/.*\\/p\\/[A-Za-z0-9_-]+/").first();
      await expect(linkBlock).toBeVisible({ timeout: 20_000 });
      const publicUrl = (await linkBlock.textContent())?.trim();
      if (!publicUrl) {
        throw new Error("No se ha podido extraer la URL pública del perfil.");
      }

      await page.goto(publicUrl);
      await expect(page.getByText(/perfil profesional con señales verificables/i).first()).toBeVisible();
      await expect(page.getByText(smokeConfig.candidate.email)).toHaveCount(0);
    } finally {
      await actor.close();
    }
  });
});
