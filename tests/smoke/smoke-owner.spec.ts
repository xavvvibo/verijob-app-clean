import { expect, test } from "@playwright/test";
import { createOwnerContext, ensureAuthenticatedActor } from "./helpers/auth";
import { installPageDiagnostics, expectNoBlankScreen } from "./helpers/diagnostics";
import { requireSmokeEmail, smokeConfig } from "./helpers/smoke-config";

const OWNER_ROUTES = [
  "/owner/overview",
  "/owner/users",
  "/owner/companies",
  "/owner/verifications",
  "/owner/evidences",
  "/owner/growth",
  "/owner/marketing",
  "/owner/monetization",
  "/owner/issues",
  "/owner/settings",
];

function toPathRegex(route: string) {
  return new RegExp(`${route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|[?#])`);
}

test.describe.serial("@owner smoke owner", () => {
  test("owner autenticado puede abrir módulos críticos", async ({ browser }, testInfo) => {
    requireSmokeEmail(smokeConfig.owner.email, "SMOKE_OWNER_EMAIL");
    const actor = await createOwnerContext(browser);
    const diagnostics = installPageDiagnostics(actor.page, testInfo, "owner-modules");

    try {
      await ensureAuthenticatedActor(actor.page, testInfo, "owner", {
        next: "/owner/overview",
      });

      for (const route of OWNER_ROUTES) {
        await actor.page.goto(route);
        await expect(actor.page).toHaveURL(toPathRegex(route));
        await expect(actor.page).not.toHaveURL(/\/login|\/signup/);
        await expectNoBlankScreen(actor.page, route);
      }

      await diagnostics.assertHealthy();
    } finally {
      await actor.close();
    }
  });
});
