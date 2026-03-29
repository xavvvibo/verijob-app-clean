import path from "node:path";
import {
  APP_URL,
  AUTH_DIR,
  CANDIDATE_DEMO,
  closeBrowser,
  completeCandidateOnboarding,
  completeOtpIfNeeded,
  ensureBaseDirs,
  getAssetStatus,
  launchBrowser,
  newFreshContext,
  pageJson,
  resolveCandidatePublicToken,
  resolveOtpFor,
  saveStorageState,
  startAuthFlow,
  tryReuseStorageState,
  waitForText,
} from "./_shared.mjs";

const STORAGE_PATH = path.join(AUTH_DIR, "candidate-demo.json");

async function isCandidateSessionValid(page) {
  const pathname = new URL(page.url()).pathname;
  return pathname.startsWith("/candidate") || pathname.startsWith("/onboarding");
}

async function ensureCandidateProfileSeed(page) {
  const payload = {
    full_name: CANDIDATE_DEMO.fullName,
    phone: CANDIDATE_DEMO.phone,
    title: CANDIDATE_DEMO.title,
    location: CANDIDATE_DEMO.location,
    skills: CANDIDATE_DEMO.skills,
  };

  const profileRes = await pageJson(page, "/api/candidate/profile", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  if (!profileRes.ok) {
    throw new Error(profileRes.body?.details || profileRes.body?.error || "No se pudo guardar el perfil candidato demo.");
  }

  const [educationRes, languagesRes, achievementsRes] = await Promise.all([
    pageJson(page, "/api/candidate/education", {
      method: "PUT",
      body: JSON.stringify({ items: CANDIDATE_DEMO.education }),
    }),
    pageJson(page, "/api/candidate/languages", {
      method: "PUT",
      body: JSON.stringify({ items: CANDIDATE_DEMO.languages }),
    }),
    pageJson(page, "/api/candidate/achievements", {
      method: "PUT",
      body: JSON.stringify({ items: CANDIDATE_DEMO.achievements }),
    }),
  ]);

  for (const response of [educationRes, languagesRes, achievementsRes]) {
    if (!response.ok) {
      throw new Error(response.body?.details || response.body?.error || "No se pudo guardar una coleccion del perfil demo.");
    }
  }
}

async function ensureExperienceRows(page) {
  await page.goto(`${APP_URL}/candidate/experience?new=1#manual-experience`, {
    waitUntil: "networkidle",
  });

  for (const experience of CANDIDATE_DEMO.experiences) {
    const experienceSignature = `${experience.roleTitle} ${experience.companyName}`;
    const alreadyVisible = await page.getByText(experienceSignature, { exact: false }).first().isVisible().catch(() => false);
    if (alreadyVisible) continue;

    await page.getByRole("button", { name: /a[nñ]adir experiencia/i }).click().catch(() => null);
    await page.getByText("Puesto", { exact: true }).waitFor({ timeout: 10_000 });

    await page.locator("label").filter({ hasText: /^Puesto$/ }).locator("input").fill(experience.roleTitle);
    await page.locator("label").filter({ hasText: /^Empresa$/ }).locator("input").fill(experience.companyName);
    await page.locator("label").filter({ hasText: /^Fecha inicio$/ }).locator("input").fill(experience.startDate);

    if (experience.isCurrent) {
      await page.getByLabel(/trabajo actualmente aqu[ií]/i).check().catch(async () => {
        await page.getByText(/trabajo actualmente aqu[ií]/i).click();
      });
    } else {
      await page.locator("label").filter({ hasText: /^Fecha fin$/ }).locator("input").fill(experience.endDate);
    }

    await page.locator("label").filter({ hasText: /Descripci[oó]n breve/i }).locator("textarea").fill(experience.description);
    await page.getByRole("button", { name: /guardar experiencia/i }).click();
    await waitForText(page, "Experiencia guardada correctamente.", 20_000);
  }
}

async function uploadCandidateCvIfPresent(page, assetMap) {
  const cv = assetMap.get("candidate-cv-demo.pdf");
  if (!cv?.exists) {
    console.warn("[demo-bootstrap] Falta candidate-cv-demo.pdf. Se omite la subida del CV.");
    return;
  }

  await page.goto(`${APP_URL}/candidate/experience#cv-upload`, { waitUntil: "networkidle" });
  const input = page.locator('input[type="file"]').first();
  await input.setInputFiles(cv.path);
  await page.getByRole("button", { name: /extraer perfil desde cv/i }).click();
  await page.waitForTimeout(2_000);
}

async function uploadCandidateEvidenceIfPresent(page, assetMap) {
  const files = [
    { name: "candidate-evidence-contract.pdf", evidenceType: "Contrato de trabajo" },
    { name: "candidate-evidence-payroll.pdf", evidenceType: "Nómina" },
  ];

  await page.goto(`${APP_URL}/candidate/evidence`, { waitUntil: "networkidle" });

  const experienceSelect = page.locator("select").nth(1);
  const optionCount = await experienceSelect.locator("option").count().catch(() => 0);
  if (optionCount < 2) {
    console.warn("[demo-bootstrap] No hay experiencias disponibles para asociar evidencias.");
    return;
  }

  const firstExperienceValue = await experienceSelect.locator("option").nth(1).getAttribute("value");
  if (!firstExperienceValue) return;

  for (const file of files) {
    const asset = assetMap.get(file.name);
    if (!asset?.exists) {
      console.warn(`[demo-bootstrap] Falta ${file.name}. Se omite esta evidencia.`);
      continue;
    }

    await page.locator("select").nth(0).selectOption({ label: file.evidenceType }).catch(() => null);
    await experienceSelect.selectOption(firstExperienceValue);
    await page.getByLabel("Archivo").setInputFiles(asset.path);
    await page.getByRole("button", { name: /subir documentaci[oó]n/i }).click();
    await page.waitForTimeout(2_000);
  }
}

async function ensureCandidateShareReady(page) {
  await page.goto(`${APP_URL}/candidate/share`, { waitUntil: "networkidle" });
  const token = await resolveCandidatePublicToken(page);
  if (!token) {
    throw new Error("No se pudo obtener el token publico del candidato demo.");
  }
  await page.goto(`${APP_URL}/p/${token}`, { waitUntil: "networkidle" });
  return token;
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
  const reused = await tryReuseStorageState(browser, STORAGE_PATH, "/candidate/overview", isCandidateSessionValid);
  const { context, page } = reused || (await newFreshContext(browser));

  try {
    if (!reused) {
      await startAuthFlow(page, {
        role: "candidate",
        email: CANDIDATE_DEMO.email,
        nextPath: "/candidate/overview",
      });
      await completeOtpIfNeeded(page, "candidate", resolveOtpFor("candidate"));
    }

    await ensureCandidateProfileSeed(page);
    await ensureExperienceRows(page);
    await uploadCandidateCvIfPresent(page, assetMap);
    await uploadCandidateEvidenceIfPresent(page, assetMap);
    await completeCandidateOnboarding(page);
    const token = await ensureCandidateShareReady(page);
    await saveStorageState(context, STORAGE_PATH);

    console.log(`OK_STORAGE=${STORAGE_PATH}`);
    console.log(`CANDIDATE_PUBLIC_TOKEN=${token}`);
  } finally {
    await context.close().catch(() => null);
    await closeBrowser(browser);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
