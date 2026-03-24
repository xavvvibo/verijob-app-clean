import { expect, test } from "@playwright/test";
import { createCandidateContext, createCompanyContext, loginWithOtp, signupWithOtp } from "./helpers/auth";
import { requireSmokeEmail, smokeConfig } from "./helpers/smoke-config";

test.describe("@auth smoke auth", () => {
  test("signup company con OTP configurable", async ({ browser }, testInfo) => {
    requireSmokeEmail(smokeConfig.company.email, "SMOKE_COMPANY_EMAIL");
    const actor = await createCompanyContext(browser);
    try {
      await signupWithOtp(actor.page, testInfo, {
        role: "company",
        email: smokeConfig.company.email,
        otp: smokeConfig.company.otp,
      });
      await expect(actor.page).toHaveURL(/\/(company|onboarding\/company)/);
    } finally {
      await actor.close();
    }
  });

  test("signup candidate con OTP configurable", async ({ browser }, testInfo) => {
    requireSmokeEmail(smokeConfig.candidate.email, "SMOKE_CANDIDATE_EMAIL");
    const actor = await createCandidateContext(browser);
    try {
      await signupWithOtp(actor.page, testInfo, {
        role: "candidate",
        email: smokeConfig.candidate.email,
        otp: smokeConfig.candidate.otp,
      });
      await expect(actor.page).toHaveURL(/\/(candidate|onboarding)/);
    } finally {
      await actor.close();
    }
  });

  test("login candidate con OTP configurable", async ({ browser }, testInfo) => {
    requireSmokeEmail(smokeConfig.candidate.email, "SMOKE_CANDIDATE_EMAIL");
    const actor = await createCandidateContext(browser);
    try {
      await loginWithOtp(actor.page, testInfo, {
        email: smokeConfig.candidate.email,
        otp: smokeConfig.candidate.otp,
        mode: "candidate",
        next: "/candidate/overview",
      });
      await expect(actor.page).toHaveURL(/\/candidate\/overview/);
    } finally {
      await actor.close();
    }
  });
});
