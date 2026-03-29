import path from "node:path";
import {
  APP_URL,
  AUTH_DIR,
  CANDIDATE_DEMO,
  COMPANY_DEMO,
  closeBrowser,
  completeCompanyOnboarding,
  completeOtpIfNeeded,
  ensureBaseDirs,
  getAssetStatus,
  launchBrowser,
  newFreshContext,
  pageFormUpload,
  pageJson,
  resolveOtpFor,
  saveStorageState,
  startAuthFlow,
  tryReuseStorageState,
} from "./_shared.mjs";

const STORAGE_PATH = path.join(AUTH_DIR, "company-demo.json");

async function isCompanySessionValid(page) {
  const pathname = new URL(page.url()).pathname;
  return pathname.startsWith("/company") || pathname.startsWith("/onboarding/company");
}

async function ensureCompanyProfileSeed(page) {
  const payload = {
    legal_name: COMPANY_DEMO.legalName,
    trade_name: COMPANY_DEMO.tradeName,
    tax_id: COMPANY_DEMO.taxId,
    company_type: COMPANY_DEMO.companyType,
    contact_email: COMPANY_DEMO.contactEmail,
    contact_phone: COMPANY_DEMO.contactPhone,
    contact_person_name: COMPANY_DEMO.contactPersonName,
    contact_person_role: COMPANY_DEMO.contactPersonRole,
    operating_address: COMPANY_DEMO.operatingAddress,
    city: COMPANY_DEMO.city,
    country: COMPANY_DEMO.country,
    sector: COMPANY_DEMO.sector,
    subsector: COMPANY_DEMO.subsector,
    business_model: COMPANY_DEMO.businessModel,
    market_segment: COMPANY_DEMO.marketSegment,
    business_description: COMPANY_DEMO.businessDescription,
  };

  const response = await pageJson(page, "/api/company/profile", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(response.body?.details || response.body?.error || "No se pudo guardar el perfil empresa demo.");
  }
}

async function uploadCompanyDocumentIfPresent(page, assetMap) {
  const asset = assetMap.get("company-doc-modelo036.pdf");
  if (!asset?.exists) {
    console.warn("[demo-bootstrap] Falta company-doc-modelo036.pdf. Se omite la subida documental de empresa.");
    return;
  }

  const response = await pageFormUpload(page, "/api/company/profile/documents", {
    fields: { document_type: "modelo_036" },
    filePath: asset.path,
  });
  if (!response.ok && response.status !== 409) {
    console.warn(`[demo-bootstrap] No se pudo subir el documento empresa: ${response.body?.error || response.status}`);
  }
}

async function importCandidateIntoCompanyIfPossible(page, assetMap) {
  const asset = assetMap.get("candidate-cv-demo.pdf");
  if (!asset?.exists) {
    console.warn("[demo-bootstrap] Falta candidate-cv-demo.pdf. No se puede sembrar la base de candidatos empresa.");
    return;
  }

  const response = await pageFormUpload(page, "/api/company/candidate-imports", {
    fields: {
      candidate_email: CANDIDATE_DEMO.email,
      candidate_name: CANDIDATE_DEMO.fullName,
      target_role: CANDIDATE_DEMO.title,
      source_notes: "Seed demo reproducible para QA y grabacion comercial.",
    },
    filePath: asset.path,
  });

  if (!response.ok) {
    const warningCode = String(response.body?.error || "");
    if (warningCode.includes("missing_migration")) {
      console.warn("[demo-bootstrap] El flujo company_candidate_imports no esta activo en esta base. El dashboard empresa quedara sin import demo.");
      return;
    }
    console.warn(`[demo-bootstrap] No se pudo importar el candidato demo: ${response.body?.error || response.status}`);
    return;
  }

  console.log("[demo-bootstrap] Import de candidato demo preparada para la empresa.");
}

async function main() {
  await ensureBaseDirs();
  const assetStatus = await getAssetStatus();
  const assetMap = new Map(assetStatus.entries.map((entry) => [entry.name, entry]));
  if (assetStatus.missing.length > 0) {
    console.warn(`[demo-bootstrap] Faltan assets demo. Revisa ${assetStatus.readmePath}`);
  }

  const headed = process.env.HEADED !== "0";
  const browser = await launchBrowser({ headed });
  const reused = await tryReuseStorageState(browser, STORAGE_PATH, "/company", isCompanySessionValid);
  const { context, page } = reused || (await newFreshContext(browser));

  try {
    if (!reused) {
      await startAuthFlow(page, {
        role: "company",
        email: COMPANY_DEMO.email,
        nextPath: "/company",
      });
      await completeOtpIfNeeded(page, "company", resolveOtpFor("company"));
    }

    await ensureCompanyProfileSeed(page);
    await uploadCompanyDocumentIfPresent(page, assetMap);
    await completeCompanyOnboarding(page);
    await importCandidateIntoCompanyIfPossible(page, assetMap);
    await page.goto(`${APP_URL}/company/candidates`, { waitUntil: "networkidle" });
    await saveStorageState(context, STORAGE_PATH);

    console.log(`OK_STORAGE=${STORAGE_PATH}`);
  } finally {
    await context.close().catch(() => null);
    await closeBrowser(browser);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
