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
const PUBLIC_PROFILE_PATTERNS = [
  new RegExp(CANDIDATE_DEMO.fullName, "i"),
  /perfil verificable/i,
  /trust score/i,
  /nivel de confianza/i,
  /experiencia/i,
  /habilidades/i,
];

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

async function seedSingleExperience(page, experience) {
  const addButton = page.getByRole("button", { name: /a[nñ]adir experiencia/i }).first();
  if (await addButton.isVisible().catch(() => false)) {
    await addButton.click({ timeout: 4_000 }).catch(() => null);
  }

  const roleField = page.getByLabel(/^puesto$/i).first();
  const companyField = page.getByLabel(/^empresa$/i).first();
  const startField = page.getByLabel(/^fecha inicio$/i).first();
  const endField = page.getByLabel(/^fecha fin$/i).first();
  const currentCheckbox = page.getByLabel(/trabajo actualmente aqu[ií]/i).first();
  const descriptionField = page.getByLabel(/descripci[oó]n breve/i).first();
  const saveButton = page.getByRole("button", { name: /guardar experiencia/i }).first();

  await roleField.waitFor({ state: "visible", timeout: 10_000 });
  await companyField.waitFor({ state: "visible", timeout: 10_000 });
  await startField.waitFor({ state: "visible", timeout: 10_000 });

  await roleField.fill(experience.roleTitle);
  await companyField.fill(experience.companyName);
  await startField.fill(experience.startDate);

  if (experience.isCurrent) {
    await currentCheckbox.check().catch(() => null);
  } else {
    await endField.fill(experience.endDate);
  }

  await descriptionField.fill(experience.description);
  await saveButton.click({ timeout: 4_000 });

  await waitForText(page, "Experiencia guardada correctamente.", 10_000).catch(() => null);
  await page.waitForTimeout(1_000);
  return hasExperienceCard(page, experience);
}

async function ensureExperienceRows(page) {
  try {
    await page.goto(`${APP_URL}/onboarding/experience?onboarding=1&intent=manual&new=1#manual-experience`, {
      waitUntil: "networkidle",
    });

    await waitForText(page, "Nombre mínimo confirmado", 10_000).catch(() => null);

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

async function ensureCandidateShareReady(page) {
  try {
    await page.goto(`${APP_URL}/candidate/share`, { waitUntil: "domcontentloaded" });
    const token = await resolveCandidatePublicToken(page).catch(() => "");
    if (!token) {
      console.warn("[demo-bootstrap] No hay token publico listo para validar el perfil demo.");
      return null;
    }

    await page.goto(`${APP_URL}/p/${token}`, { waitUntil: "domcontentloaded" });

    let validated = false;
    for (const pattern of PUBLIC_PROFILE_PATTERNS) {
      const visible = await page.getByText(pattern, { exact: false }).first().isVisible().catch(() => false);
      if (visible) {
        validated = true;
        break;
      }
    }

    if (!validated) {
      const headingVisible = await page.locator("h1, h2").first().isVisible().catch(() => false);
      validated = headingVisible;
    }

    if (!validated) {
      console.warn("[demo-bootstrap] No pude validar completamente el perfil público demo en la UI actual.");
    }

    return token;
  } catch (error) {
    console.warn("[demo-bootstrap] No pude validar completamente el perfil público demo en la UI actual.");
    console.warn(`[demo-bootstrap] Continúo sin bloquear el bootstrap: ${String(error?.message || error)}`);
    return null;
  }
}

async function main() {
  await ensureBaseDirs();
  const assetStatus = await getAssetStatus();
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
