import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeCompanyProfileAccessProductKey,
  resolveCompanyProfileAccessCreditsGranted,
  resolveCompanyProfileAccessProductLabel,
} from "../src/lib/company/profile-access-products.js";

test("normaliza productos de acceso de empresa a claves canónicas", () => {
  assert.equal(normalizeCompanyProfileAccessProductKey("company_single_profile"), "company_single_cv");
  assert.equal(normalizeCompanyProfileAccessProductKey("company_single_cv"), "company_single_cv");
  assert.equal(normalizeCompanyProfileAccessProductKey("company_pack5_profiles"), "company_pack_5");
  assert.equal(normalizeCompanyProfileAccessProductKey("company_pack_5"), "company_pack_5");
  assert.equal(normalizeCompanyProfileAccessProductKey("other"), null);
});

test("asigna correctamente +1 y +5 accesos según el producto", () => {
  assert.equal(resolveCompanyProfileAccessCreditsGranted("company_single_profile"), 1);
  assert.equal(resolveCompanyProfileAccessCreditsGranted("company_single_cv"), 1);
  assert.equal(resolveCompanyProfileAccessCreditsGranted("company_pack5_profiles"), 5);
  assert.equal(resolveCompanyProfileAccessCreditsGranted("company_pack_5"), 5);
  assert.equal(resolveCompanyProfileAccessCreditsGranted("other"), 0);
});

test("expone labels comerciales correctos para superficies de usuario", () => {
  assert.equal(resolveCompanyProfileAccessProductLabel("company_single_cv"), "1 acceso");
  assert.equal(resolveCompanyProfileAccessProductLabel("company_pack_5"), "Pack de 5 accesos");
  assert.equal(resolveCompanyProfileAccessProductLabel("other"), "Accesos");
});
