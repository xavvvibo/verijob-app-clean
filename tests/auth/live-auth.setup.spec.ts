import { expect, test } from "@playwright/test";
import {
  createCandidateContext,
  createCompanyContext,
  createOwnerContext,
  ensureAuthenticatedActor,
} from "../smoke/helpers/auth";
import { smokeConfig } from "../smoke/helpers/smoke-config";

function shouldRunActor(actor: "candidate" | "company" | "owner") {
  const raw = String(process.env.SMOKE_AUTH_SETUP_SCOPE || "all").trim().toLowerCase();
  if (!raw || raw === "all") return true;
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .includes(actor);
}

test.describe.serial("@auth-setup live auth setup", () => {
  test("candidate auth state renovable", async ({ browser }, testInfo) => {
    test.skip(!shouldRunActor("candidate"), "SMOKE_AUTH_SETUP_SCOPE excluye candidate");
    const actor = await createCandidateContext(browser);

    try {
      const status = await ensureAuthenticatedActor(actor.page, testInfo, "candidate", {
        next: "/candidate/overview",
      });
      await expect(actor.page).toHaveURL(/\/candidate\/overview|\/onboarding(\/)?$/);
      console.log(`[auth-setup] candidate=${status} storage=${smokeConfig.candidate.storageStatePath}`);
    } finally {
      await actor.close();
    }
  });

  test("company auth state renovable", async ({ browser }, testInfo) => {
    test.skip(!shouldRunActor("company"), "SMOKE_AUTH_SETUP_SCOPE excluye company");
    const actor = await createCompanyContext(browser);

    try {
      const status = await ensureAuthenticatedActor(actor.page, testInfo, "company", {
        next: "/company",
      });
      await expect(actor.page).toHaveURL(/\/company|\/onboarding\/company/);
      console.log(`[auth-setup] company=${status} storage=${smokeConfig.company.storageStatePath}`);
    } finally {
      await actor.close();
    }
  });

  test("owner auth state renovable", async ({ browser }, testInfo) => {
    test.skip(!shouldRunActor("owner"), "SMOKE_AUTH_SETUP_SCOPE excluye owner");
    const actor = await createOwnerContext(browser);

    try {
      const status = await ensureAuthenticatedActor(actor.page, testInfo, "owner", {
        next: "/owner/overview",
      });
      await expect(actor.page).toHaveURL(/\/owner(\/overview)?/);
      console.log(`[auth-setup] owner=${status} storage=${smokeConfig.owner.storageStatePath}`);
    } finally {
      await actor.close();
    }
  });
});
