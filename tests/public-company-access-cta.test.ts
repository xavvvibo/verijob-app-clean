import test from "node:test";
import assert from "node:assert/strict";
import { resolvePublicCompanyAccessCta } from "../src/lib/public/company-access-cta.ts";

const token = "f5ad2c54e2832a1e86eca65f09431da2332abe2e45f29991";

test("public company CTA usa flujo empresa cuando hay sesión empresa activa", () => {
  const result = resolvePublicCompanyAccessCta({
    token,
    companyViewer: {
      is_authenticated_company: true,
      available_accesses: 3,
      already_unlocked: false,
    },
  });

  assert.equal(result.companyIsAuthenticated, true);
  assert.equal(result.companyPreviewHref, `/company/candidate/${token}`);
  assert.equal(result.companyFullHref, `/company/candidate/${token}?view=full`);
  assert.equal(result.companyUnlockHref, `/api/company/candidate/${token}/unlock`);
  assert.match(result.loginUrl, /\/login\?mode=company/);
});

test("public company CTA mantiene login/signup cuando no hay sesión empresa", () => {
  const result = resolvePublicCompanyAccessCta({ token, companyViewer: null });

  assert.equal(result.companyIsAuthenticated, false);
  assert.equal(result.signupUrl, `/signup?mode=company&next=${encodeURIComponent(`/company/candidate/${token}`)}`);
  assert.equal(result.loginUrl, `/login?mode=company&next=${encodeURIComponent(`/company/candidate/${token}`)}`);
});
