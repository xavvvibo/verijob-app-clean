import { expect, test } from "@playwright/test";
import { createCompanyContext, ensureAuthenticatedActor } from "./helpers/auth";
import { requireSmokeEmail, smokeConfig } from "./helpers/smoke-config";

const TOKEN = process.env.SMOKE_COMPANY_PUBLIC_TOKEN || "9b3383905a508e4de1f9700412e3559a07bd82e399c3989b";

function parseAvailableAccesses(body: string) {
  const match =
    body.match(/Accesos disponibles\s+(\d+)/i) ||
    body.match(/Accesos a perfiles disponibles\s+(\d+)/i) ||
    body.match(/(\d+)\s+disponibles ahora mismo/i) ||
    body.match(/(\d+)\s+accesos disponibles/i) ||
    body.match(/dispones de\s+(\d+)\s+accesos/i);

  return match ? Number(match[1]) : null;
}

async function readAvailableAccessesFrom(page: any, route: string, label: string) {
  await page.goto(route);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(3000);

  const body = await page.locator("body").innerText();
  const parsed = parseAvailableAccesses(body);

  if (parsed !== null) return parsed;

  console.log(`\n=== ${label} ===\n`);
  console.log(body.slice(0, 8000));
  return null;
}

async function readAvailableAccesses(page: any) {
  const fromCompany = await readAvailableAccessesFrom(page, "/company", "BODY_/company");
  if (fromCompany !== null) return fromCompany;

  const fromSubscription = await readAvailableAccessesFrom(
    page,
    "/company/subscription",
    "BODY_/company/subscription",
  );
  if (fromSubscription !== null) return fromSubscription;

  throw new Error("No pude leer el contador de accesos disponibles ni en /company ni en /company/subscription");
}

async function dumpBody(page: any, label: string, max = 7000) {
  const body = await page.locator("body").innerText();
  console.log(`\n=== ${label} ===\n`);
  console.log(body.slice(0, max));
}

test("empresa autenticada /p/[token] -> unlock -> consumo -> reapertura", async ({ browser }, testInfo) => {
  requireSmokeEmail(smokeConfig.company.email, "SMOKE_COMPANY_EMAIL");
  const actor = await createCompanyContext(browser);

  try {
    const { page } = actor;

    await ensureAuthenticatedActor(page, testInfo, "company", {
      next: "/company",
    });

    const accessesBefore = await readAvailableAccesses(page);
    console.log(`\nACCESOS_ANTES=${accessesBefore}\n`);

    await page.goto(`/p/${TOKEN}`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(4000);

    const urlPublic = page.url();
    console.log(`URL_PUBLICA=${urlPublic}`);
    await dumpBody(page, "BODY_EN_/p/TOKEN_ANTES", 5000);

    const bodyPublic = (await page.locator("body").innerText()).toLowerCase();
    if (
      bodyPublic.includes("activar cuenta de empresa") ||
      bodyPublic.includes("alta empresa") ||
      bodyPublic.includes("enviar código") ||
      /\/login\?mode=company|\/signup\?mode=company/i.test(urlPublic)
    ) {
      throw new Error("Fallo real: estando autenticado como empresa, /p/[token] sigue mostrando auth pública");
    }

    // CTA principal precisa: evitar selector genérico que puede clicar otro enlace
    const previewOpenButton = page.getByRole("button", { name: /ver perfil completo \(-1 acceso\)|abrir perfil completo|ver perfil completo/i }).first();
    const alreadyUnlockedButton = page.getByRole("button", { name: /abrir perfil completo/i }).first();

    if (await alreadyUnlockedButton.isVisible().catch(() => false)) {
      await alreadyUnlockedButton.click();
    } else {
      await expect(previewOpenButton).toBeVisible({ timeout: 15000 });
      await previewOpenButton.click();

      // Si aparece modal de confirmación, confirmar allí
      const modalConfirmButton = page.getByRole("button", { name: /^ver perfil completo$/i }).last();
      if (await modalConfirmButton.isVisible().catch(() => false)) {
        await modalConfirmButton.click();
      }
    }

    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(5000);

    const urlAfterCta = page.url();
    console.log(`\nURL_TRAS_CTA=${urlAfterCta}`);
    await dumpBody(page, "BODY_TRAS_CTA", 6000);

    if (/\/login|\/signup/i.test(urlAfterCta)) {
      throw new Error(`CTA incorrecto: redirige a auth (${urlAfterCta})`);
    }

    const bodyAfterCta = (await page.locator("body").innerText()).toLowerCase();
    if (bodyAfterCta.includes("activar cuenta de empresa") || bodyAfterCta.includes("alta empresa")) {
      throw new Error("CTA incorrecto: tras pulsar CTA se muestra auth pública de empresa");
    }

    if (bodyAfterCta.includes("perfil (empresa)") && bodyAfterCta.includes("no encontrado")) {
      throw new Error(`La vista privada de empresa no resuelve el perfil completo para el token: ${urlAfterCta}`);
    }

    if (bodyAfterCta.includes("error")) {
      throw new Error("Error visible tras CTA/unlock");
    }

    const accessesAfterFirst = await readAvailableAccesses(page);
    console.log(`\nACCESOS_DESPUES_PRIMER_UNLOCK=${accessesAfterFirst}\n`);

    await page.goto(`/p/${TOKEN}`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(4000);

    const bodyReopen = (await page.locator("body").innerText()).toLowerCase();
    await dumpBody(page, "BODY_REAPERTURA", 5000);

    if (bodyReopen.includes("activar cuenta de empresa") || bodyReopen.includes("alta empresa")) {
      throw new Error("Reapertura incorrecta: reaparece auth pública tras unlock inicial");
    }

    const accessesAfterReopen = await readAvailableAccesses(page);
    console.log(`\nACCESOS_DESPUES_REAPERTURA=${accessesAfterReopen}\n`);

    if (accessesAfterFirst !== accessesBefore - 1) {
      throw new Error(
        `Consumo incorrecto en primer unlock: antes=${accessesBefore}, despues=${accessesAfterFirst}`,
      );
    }

    if (accessesAfterReopen !== accessesAfterFirst) {
      throw new Error(
        `Reapertura consumio de nuevo: despuesPrimerUnlock=${accessesAfterFirst}, despuesReapertura=${accessesAfterReopen}`,
      );
    }

    console.log("\n=== RESULTADO ===");
    console.log("PASS: unlock consume 1 acceso y la reapertura no vuelve a consumir.\n");
  } finally {
    await actor.close();
  }
});
