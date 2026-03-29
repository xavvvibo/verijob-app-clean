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
const EXPERIENCE_ROLE_PATTERNS = [/^puesto$/i, /^cargo$/i, /^job title$/i, /puesto/i, /cargo/i, /job title/i];
const EXPERIENCE_COMPANY_PATTERNS = [/^empresa$/i, /^compa[nñ][ií]a$/i, /^company$/i, /empresa/i, /company/i];
const EXPERIENCE_START_PATTERNS = [/^fecha inicio$/i, /^inicio$/i, /^start date$/i, /fecha.*inicio/i, /start date/i];
const EXPERIENCE_END_PATTERNS = [/^fecha fin$/i, /^fin$/i, /^end date$/i, /fecha.*fin/i, /end date/i];
const EXPERIENCE_DESCRIPTION_PATTERNS = [/descripci[oó]n breve/i, /^descripci[oó]n$/i, /^summary$/i, /^description$/i];
const EXPERIENCE_CURRENT_PATTERNS = [/trabajo actualmente aqu[ií]/i, /actualmente/i, /current/i, /present/i];
const EXPERIENCE_ADD_BUTTON_PATTERNS = [/a[nñ]adir experiencia/i, /nueva experiencia/i, /add experience/i];
const EXPERIENCE_SAVE_BUTTON_PATTERNS = [/guardar experiencia/i, /guardar/i, /save experience/i, /save/i];

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

async function findInputByPatterns(page, patterns, options = {}) {
  const inputTypes = options.textarea ? "textarea" : 'input, textarea';

  for (const pattern of patterns) {
    const label = page.locator("label").filter({ hasText: pattern }).first();
    if ((await label.count()) > 0) {
      const field = label.locator(inputTypes).first();
      if ((await field.count()) > 0 && (await field.isVisible().catch(() => false))) {
        return field;
      }
    }
  }

  for (const pattern of patterns) {
    const byLabel = page.getByLabel(pattern).first();
    if ((await byLabel.count()) > 0 && (await byLabel.isVisible().catch(() => false))) {
      return byLabel;
    }
  }

  const placeholders = [
    ...patterns,
    /empresa/i,
    /company/i,
    /puesto/i,
    /cargo/i,
    /job title/i,
    /aaaa-mm/i,
  ];

  for (const pattern of placeholders) {
    const byPlaceholder = page.getByPlaceholder(pattern).first();
    if ((await byPlaceholder.count()) > 0 && (await byPlaceholder.isVisible().catch(() => false))) {
      return byPlaceholder;
    }
  }

  const genericSelectors = options.textarea
    ? ["textarea[name*='description' i]", "textarea[id*='description' i]", "textarea"]
    : [
        "input[name*='role' i]",
        "input[name*='title' i]",
        "input[name*='puesto' i]",
        "input[name*='cargo' i]",
        "input[id*='role' i]",
        "input[id*='title' i]",
        "input[id*='puesto' i]",
        "input[id*='cargo' i]",
        "input[name*='company' i]",
        "input[name*='empresa' i]",
        "input[id*='company' i]",
        "input[id*='empresa' i]",
        "input",
      ];

  for (const selector of genericSelectors) {
    const field = page.locator(selector).first();
    if ((await field.count()) > 0 && (await field.isVisible().catch(() => false))) {
      return field;
    }
  }

  return null;
}

async function clickFirstMatchingButton(page, patterns) {
  for (const pattern of patterns) {
    const button = page.getByRole("button", { name: pattern }).first();
    if ((await button.count()) === 0) continue;
    const visible = await button.isVisible().catch(() => false);
    if (!visible) continue;
    await button.click({ timeout: 4_000 }).catch(() => null);
    return true;
  }
  return false;
}

async function hasExperienceCard(page, experience) {
  const roleVisible = await page.getByText(experience.roleTitle, { exact: false }).first().isVisible().catch(() => false);
  const companyVisible = await page.getByText(experience.companyName, { exact: false }).first().isVisible().catch(() => false);
  if (roleVisible && companyVisible) return true;

  const combinedVisible = await page
    .getByText(new RegExp(`${experience.roleTitle}.*${experience.companyName}|${experience.companyName}.*${experience.roleTitle}`, "i"))
    .first()
    .isVisible()
    .catch(() => false);
  return combinedVisible;
}

async function openExperienceForm(page) {
  await clickFirstMatchingButton(page, EXPERIENCE_ADD_BUTTON_PATTERNS);

  const roleField =
    (await findInputByPatterns(page, EXPERIENCE_ROLE_PATTERNS)) ||
    (await findInputByPatterns(page, EXPERIENCE_COMPANY_PATTERNS));

  return roleField;
}

async function seedSingleExperience(page, experience) {
  const roleField = await openExperienceForm(page);
  if (!roleField) return false;

  const companyField = await findInputByPatterns(page, EXPERIENCE_COMPANY_PATTERNS);
  const startField = await findInputByPatterns(page, EXPERIENCE_START_PATTERNS);
  const endField = await findInputByPatterns(page, EXPERIENCE_END_PATTERNS);
  const descriptionField = await findInputByPatterns(page, EXPERIENCE_DESCRIPTION_PATTERNS, { textarea: true });

  if (!companyField || !startField) {
    return false;
  }

  await roleField.fill(experience.roleTitle);
  await companyField.fill(experience.companyName);
  await startField.fill(experience.startDate);

  if (experience.isCurrent) {
    for (const pattern of EXPERIENCE_CURRENT_PATTERNS) {
      const checkbox = page.getByLabel(pattern).first();
      if ((await checkbox.count()) > 0) {
        await checkbox.check().catch(() => null);
        break;
      }

      const toggleText = page.getByText(pattern, { exact: false }).first();
      if ((await toggleText.count()) > 0) {
        await toggleText.click().catch(() => null);
        break;
      }
    }
  } else if (endField) {
    await endField.fill(experience.endDate);
  }

  if (descriptionField) {
    await descriptionField.fill(experience.description);
  }

  const saved = await clickFirstMatchingButton(page, EXPERIENCE_SAVE_BUTTON_PATTERNS);
  if (!saved) return false;

  await page.waitForTimeout(1_500);
  return hasExperienceCard(page, experience);
}

async function ensureExperienceRows(page) {
  try {
    await page.goto(`${APP_URL}/candidate/experience?new=1#manual-experience`, {
      waitUntil: "networkidle",
    });

    const existingCount = await Promise.all(CANDIDATE_DEMO.experiences.map((experience) => hasExperienceCard(page, experience)));
    const existingEnough = existingCount.filter(Boolean).length >= CANDIDATE_DEMO.experiences.length;
    if (existingEnough) {
      console.log("[demo-bootstrap] Las experiencias demo ya existen. No se duplican.");
      return;
    }

    for (const experience of CANDIDATE_DEMO.experiences) {
      const alreadyVisible = await hasExperienceCard(page, experience);
      if (alreadyVisible) {
        console.log(`[demo-bootstrap] Experiencia ya presente: ${experience.roleTitle} @ ${experience.companyName}`);
        continue;
      }

      const created = await seedSingleExperience(page, experience);
      if (!created) {
        console.warn("[demo-bootstrap] No pude sembrar experiencias por selector no compatible con la UI actual.");
        console.warn(`[demo-bootstrap] Continúo sin bloquear el bootstrap. Experiencia pendiente: ${experience.roleTitle} @ ${experience.companyName}`);
        return;
      }

      await waitForText(page, experience.roleTitle, 10_000).catch(() => null);
    }
  } catch (error) {
    console.warn("[demo-bootstrap] No pude sembrar experiencias por selector no compatible con la UI actual.");
    console.warn(`[demo-bootstrap] Continúo sin bloquear el bootstrap: ${String(error?.message || error)}`);
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
