import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const REPO_ROOT = path.resolve(__dirname, "..", "..");
export const AUTH_DIR = path.join(REPO_ROOT, "playwright", ".auth");
export const DEMO_ASSETS_DIR = path.join(REPO_ROOT, "demo-assets");
export const SCRIPTS_DIR = path.join(REPO_ROOT, "scripts", "demo-bootstrap");
export const APP_URL = String(process.env.APP_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
export const VIEWPORT = { width: 1440, height: 960 };

export const CANDIDATE_DEMO = {
  email: "candidato-test@califystaff.com",
  fullName: "Lucia Torres Vega",
  title: "Especialista en operaciones y atencion al cliente",
  location: "Madrid, Espana",
  phone: "+34612000111",
  experiences: [
    {
      roleTitle: "Especialista de operaciones",
      companyName: "Northgate Support",
      startDate: "2022-09",
      endDate: "",
      isCurrent: true,
      description: "Coordino incidencias, seguimiento operativo y control de SLA con equipos internos y cliente final.",
    },
    {
      roleTitle: "Agente de atencion al cliente",
      companyName: "Helix Contact Center",
      startDate: "2020-02",
      endDate: "2022-08",
      isCurrent: false,
      description: "Gestione soporte multicanal, fidelizacion y reporting de calidad sobre volumen de casos resueltos.",
    },
  ],
  education: [
    {
      title: "Tecnico Superior en Administracion y Finanzas",
      institution: "IES Clara del Rey",
      start_date: "2017-09",
      end_date: "2019-06",
      description: "Base administrativa y operativa orientada a entornos de servicio.",
      is_visible: true,
    },
  ],
  languages: [
    { language_name: "Espanol", proficiency_level: "Nativo", is_native: true, is_visible: true },
    { language_name: "Ingles", proficiency_level: "B2", is_native: false, notes: "Atencion al cliente y documentacion.", is_visible: true },
  ],
  achievements: [
    {
      title: "Mejora de SLA en soporte",
      description: "Ayude a reducir tiempos medios de respuesta y escalado operativo.",
      achievement_type: "otro",
      issuer: "Northgate Support",
      achieved_at: "2024-11",
      is_visible: true,
    },
  ],
  skills: [
    { name: "Atencion al cliente", source_type: "self", verified: false },
    { name: "Gestion operativa", source_type: "self", verified: false },
    { name: "Resolucion de incidencias", source_type: "self", verified: false },
    { name: "Reporting", source_type: "self", verified: false },
  ],
};

export const COMPANY_DEMO = {
  email: "empresa-test@califystaff.com",
  legalName: "Calify Staff Demo S.L.",
  tradeName: "Calify Staff Demo",
  taxId: "B12345678",
  companyType: "sociedad_limitada",
  sector: "Recursos humanos",
  subsector: "Seleccion y evaluacion",
  businessModel: "B2B",
  marketSegment: "PYME",
  contactPersonName: "Sofia Navarro",
  contactPersonRole: "Talent Lead",
  contactEmail: "empresa-test@califystaff.com",
  contactPhone: "+34910000111",
  operatingAddress: "Calle de Alcala 120, Madrid",
  city: "Madrid",
  country: "Espana",
  businessDescription: "Equipo demo para grabaciones, QA y flujos comerciales de seleccion con contexto verificable.",
};

export const REQUIRED_ASSETS = [
  "candidate-cv-demo.pdf",
  "candidate-evidence-contract.pdf",
  "candidate-evidence-payroll.pdf",
  "company-doc-modelo036.pdf",
];

export async function ensureBaseDirs() {
  await fs.mkdir(SCRIPTS_DIR, { recursive: true });
  await fs.mkdir(DEMO_ASSETS_DIR, { recursive: true });
  await fs.mkdir(AUTH_DIR, { recursive: true });
}

export async function writeAssetsReadme() {
  const readmePath = path.join(DEMO_ASSETS_DIR, "README.md");
  const lines = [
    "# Demo Assets",
    "",
    "Coloca aqui los ficheros demo usados por los scripts de bootstrap y grabacion.",
    "",
    "Archivos esperados:",
    "",
    "- `candidate-cv-demo.pdf`: CV neutro del candidato demo.",
    "- `candidate-evidence-contract.pdf`: contrato demo para asociar a una experiencia.",
    "- `candidate-evidence-payroll.pdf`: nomina demo para asociar a una experiencia.",
    "- `company-doc-modelo036.pdf`: documento demo de empresa para verificacion documental.",
    "",
    "Recomendaciones:",
    "",
    "- Usa solo datos ficticios o anonimizados.",
    "- No subas DNI reales ni informacion sensible de terceros.",
    "- Mantén PDFs ligeros y legibles para demos y grabaciones.",
  ].join("\n");
  await fs.writeFile(readmePath, `${lines}\n`, "utf8");
  return readmePath;
}

export async function getAssetStatus() {
  await ensureBaseDirs();
  const readmePath = await writeAssetsReadme();
  const entries = await Promise.all(
    REQUIRED_ASSETS.map(async (name) => {
      const filePath = path.join(DEMO_ASSETS_DIR, name);
      try {
        const stat = await fs.stat(filePath);
        return { name, path: filePath, exists: stat.isFile(), size: stat.size };
      } catch {
        return { name, path: filePath, exists: false, size: 0 };
      }
    }),
  );
  return { readmePath, entries, missing: entries.filter((entry) => !entry.exists) };
}

export function resolveOtpFor(role) {
  const upper = role.toUpperCase();
  return String(
    process.env[`DEMO_${upper}_OTP`] ||
      process.env[`SMOKE_${upper}_OTP`] ||
      process.env[`${upper}_OTP`] ||
      "",
  ).trim();
}

export async function launchBrowser({ headed = true, slowMo = 150 } = {}) {
  return chromium.launch({
    headless: !headed,
    slowMo,
  });
}

export async function tryReuseStorageState(browser, storagePath, targetPath, validate) {
  try {
    await fs.access(storagePath);
  } catch {
    return null;
  }

  const context = await browser.newContext({
    storageState: storagePath,
    viewport: VIEWPORT,
  });
  const page = await context.newPage();

  try {
    await page.goto(`${APP_URL}${targetPath}`, { waitUntil: "networkidle" });
    if (await validate(page)) {
      console.log(`[demo-bootstrap] Reutilizando sesion valida: ${storagePath}`);
      return { context, page };
    }
  } catch (error) {
    console.warn(`[demo-bootstrap] No se pudo reutilizar ${storagePath}: ${String(error?.message || error)}`);
  }

  await context.close();
  return null;
}

export async function newFreshContext(browser) {
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  return { context, page };
}

export async function ensureLoggedOut(page) {
  await page.goto(`${APP_URL}/login`, { waitUntil: "domcontentloaded" });
}

const AUTH_BUTTON_PATTERNS = [
  /enviar c[oó]digo/i,
  /continuar con email/i,
  /continuar/i,
  /seguir/i,
  /acceder/i,
  /entrar/i,
  /enviar/i,
];

async function clickIfVisible(page, selector) {
  const locator = page.locator(selector).first();
  if ((await locator.count()) > 0) {
    await locator.click({ timeout: 5_000 }).catch(() => null);
    return true;
  }
  return false;
}

async function waitForOtpInput(page, timeout = 4_000) {
  try {
    await page.getByPlaceholder("123456").waitFor({ state: "visible", timeout });
    console.log("[demo-bootstrap] OTP detectado, continuando...");
    return true;
  } catch {
    return false;
  }
}

async function promptManualOtpStep() {
  console.warn("[demo-bootstrap] No encontré botón compatible. Continúa manualmente en el navegador.");
  console.warn("[demo-bootstrap] Cuando aparezca el campo OTP, vuelve a Terminal y pulsa ENTER.");

  if (!input.isTTY || !output.isTTY) return;

  const rl = readline.createInterface({ input, output });
  try {
    await rl.question("");
  } finally {
    rl.close();
  }
}

async function triggerAuthContinue(page) {
  console.log("[demo-bootstrap] Intentando flujo automático de auth...");

  for (const pattern of AUTH_BUTTON_PATTERNS) {
    const button = page.getByRole("button", { name: pattern }).first();
    if ((await button.count()) === 0) continue;
    const visible = await button.isVisible().catch(() => false);
    if (!visible) continue;

    try {
      await button.click({ timeout: 3_000 });
      return { clicked: true, pattern: String(pattern) };
    } catch {}
  }

  return { clicked: false, pattern: null };
}

async function submitAuthScreen(page) {
  const automatic = await triggerAuthContinue(page);
  if (automatic.clicked) {
    const otpVisible = await waitForOtpInput(page, 5_000);
    if (otpVisible) return true;
  }

  await promptManualOtpStep();
  return waitForOtpInput(page, 2_000);
}

export async function startAuthFlow(page, { role, email, nextPath }) {
  const signupUrl = new URL(`${APP_URL}/signup`);
  signupUrl.searchParams.set("mode", role);
  if (nextPath) signupUrl.searchParams.set("next", nextPath);

  await page.goto(signupUrl.toString(), { waitUntil: "networkidle" });
  await clickIfVisible(page, `button:has-text("${role === "company" ? "Empresa" : "Candidato"}")`);

  await page.getByPlaceholder("tu@email.com").fill(email);
  const signupReachedOtp = await submitAuthScreen(page);

  if (!signupReachedOtp) {
    const loginUrl = new URL(`${APP_URL}/login`);
    loginUrl.searchParams.set("mode", role);
    if (nextPath) loginUrl.searchParams.set("next", nextPath);
    await page.goto(loginUrl.toString(), { waitUntil: "networkidle" });
    await page.getByPlaceholder("tu@email.com").fill(email);
    await submitAuthScreen(page);
  }
}

export async function completeOtpIfNeeded(page, role, otp) {
  const otpInput = page.getByPlaceholder("123456");
  const isVisible = await otpInput.isVisible().catch(() => false);
  if (!isVisible) return;

  if (otp) {
    await otpInput.fill(otp);
    await page.getByRole("button", { name: /verificar c[oó]digo/i }).click();
  } else {
    console.log(`[demo-bootstrap] OTP manual requerido para ${role}. Completa el codigo en el navegador.`);
  }

  await Promise.race([
    page.waitForURL((url) => {
      const pathname = new URL(url).pathname;
      return !pathname.startsWith("/login") && !pathname.startsWith("/signup");
    }, { timeout: 600_000 }),
    page.waitForFunction(() => {
      const otp = document.querySelector('input[placeholder="123456"]');
      return !otp;
    }, null, { timeout: 600_000 }),
  ]);
}

export async function pageJson(page, route, init = {}) {
  return page.evaluate(
    async ({ route, init }) => {
      const response = await fetch(route, {
        credentials: "include",
        cache: "no-store",
        ...init,
        headers: {
          "content-type": "application/json",
          ...(init.headers || {}),
        },
        body: init.body,
      });
      const text = await response.text().catch(() => "");
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = { raw: text };
      }
      return { ok: response.ok, status: response.status, body: json };
    },
    { route, init },
  );
}

export async function pageFormUpload(page, route, { fields = {}, fileField = "file", filePath, mimeType = "application/pdf" }) {
  const buffer = await fs.readFile(filePath);
  const base64 = buffer.toString("base64");
  const filename = path.basename(filePath);

  return page.evaluate(
    async ({ route, fields, fileField, filename, mimeType, base64 }) => {
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      const file = new File([bytes], filename, { type: mimeType });
      const formData = new FormData();

      for (const [key, value] of Object.entries(fields || {})) {
        if (value === undefined || value === null || value === "") continue;
        formData.append(key, String(value));
      }

      formData.append(fileField, file);

      const response = await fetch(route, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const text = await response.text().catch(() => "");
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = { raw: text };
      }
      return { ok: response.ok, status: response.status, body: json };
    },
    { route, fields, fileField, filename, mimeType, base64 },
  );
}

export async function sha256OfFile(filePath) {
  const buffer = await fs.readFile(filePath);
  return createHash("sha256").update(buffer).digest("hex");
}

export async function completeCandidateOnboarding(page) {
  const response = await pageJson(page, "/api/onboarding/complete", {
    method: "POST",
    body: JSON.stringify({ onboarding_step: "finish" }),
  });
  if (!response.ok) {
    throw new Error(response.body?.details || response.body?.error || "No se pudo completar el onboarding candidato.");
  }
  await page.goto(`${APP_URL}/candidate/overview`, { waitUntil: "networkidle" });
}

export async function completeCompanyOnboarding(page) {
  const response = await pageJson(page, "/api/company/onboarding/complete", {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(response.body?.details || response.body?.error || "No se pudo completar el onboarding empresa.");
  }
  await page.goto(`${APP_URL}/company`, { waitUntil: "networkidle" });
}

export async function saveStorageState(context, storagePath) {
  await fs.mkdir(path.dirname(storagePath), { recursive: true });
  await context.storageState({ path: storagePath });
}

export async function resolveCandidatePublicToken(page) {
  const response = await pageJson(page, "/api/candidate/public-link", { method: "POST" });
  if (!response.ok) {
    throw new Error(response.body?.error || "No se pudo generar el token publico del candidato.");
  }
  return String(response.body?.token || "");
}

export async function resolveCurrentUrl(page) {
  return page.evaluate(() => window.location.pathname + window.location.search + window.location.hash);
}

export async function waitForText(page, text, timeout = 20_000) {
  await page.getByText(text, { exact: false }).waitFor({ timeout });
}

export async function closeBrowser(browser) {
  await browser.close();
}
