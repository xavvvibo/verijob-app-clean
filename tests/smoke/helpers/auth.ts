import { expect, type Browser, type BrowserContext, type Page, type TestInfo } from "@playwright/test";
import { access } from "node:fs/promises";
import { actorConfig, isAuthenticatedUrl, persistStorageState, type PrivateActorLabel } from "./smoke-config";

type SmokeActorContext = {
  context: BrowserContext;
  page: Page;
  close: () => Promise<void>;
};

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function createActorContext(
  browser: Browser,
  actorLabel: PrivateActorLabel | "public",
): Promise<SmokeActorContext> {
  console.log(`[smoke] Running ${actorLabel} flow in isolated context`);

  const config = actorLabel === "public" ? null : actorConfig(actorLabel);
  const storageStatePath =
    config && config.useStorageState && (await fileExists(config.storageStatePath))
      ? config.storageStatePath
      : undefined;

  const context = await browser.newContext(
    storageStatePath ? { storageState: storageStatePath } : undefined,
  );
  const page = await context.newPage();

  return {
    context,
    page,
    close: async () => {
      await context.close();
    },
  };
}

export async function createCandidateContext(browser: Browser) {
  return createActorContext(browser, "candidate");
}

export async function createCompanyContext(browser: Browser) {
  return createActorContext(browser, "company");
}

export async function createOwnerContext(browser: Browser) {
  return createActorContext(browser, "owner");
}

export async function createPublicContext(browser: Browser) {
  return createActorContext(browser, "public");
}

async function fillOtp(page: Page, otp: string) {
  await page.getByPlaceholder("123456").fill(otp);

  await Promise.allSettled([
    page.waitForURL((url) => !/\/login|\/signup/i.test(url.pathname), {
      timeout: 20000,
    }),
    page.getByRole("button", { name: /continuar|verificar código/i }).click(),
  ]);
}

export async function completeOtpStep(
  page: Page,
  testInfo: TestInfo,
  params: { otp?: string; actorLabel: string },
) {
  await expect(page.getByPlaceholder("123456")).toBeVisible();

  if (params.otp) {
    await fillOtp(page, params.otp);
    return;
  }

  if (testInfo.project.use.headless) {
    throw new Error(
      `Falta OTP para ${params.actorLabel}. Ejecuta con SMOKE_${params.actorLabel.toUpperCase()}_OTP o en modo headed.`,
    );
  }

  console.log(`[smoke] OTP manual requerido para ${params.actorLabel}`);
  await page.pause();
}

async function submitLoginAndWaitForNextStep(page: Page) {
  await page.getByRole("button", { name: /continuar|enviar código/i }).click();

  const otpLocator = page.getByPlaceholder("123456");
  const errorLocator = page.getByText(/error|inválido|incorrecto|no se ha podido|try again|algo ha ido mal/i);

  await Promise.race([
    otpLocator.waitFor({ state: "visible", timeout: 15000 }),
    errorLocator.first().waitFor({ state: "visible", timeout: 15000 }),
    page.waitForURL((url) => !/\/login|\/signup/i.test(url.pathname), { timeout: 15000 }),
  ]);

  if (await errorLocator.first().isVisible().catch(() => false)) {
    const message = await errorLocator.first().textContent().catch(() => null);
    throw new Error(`Error visible tras login: ${message || "mensaje no legible"}`);
  }
}

export async function signupWithOtp(
  page: Page,
  testInfo: TestInfo,
  params: {
    role: "candidate" | "company";
    email: string;
    otp?: string;
  },
) {
  await page.goto(`/signup?mode=${params.role}`);
  await expect(
    page.getByRole("heading", {
      name:
        params.role === "company"
          ? /activar cuenta de empresa/i
          : /crear cuenta en verijob/i,
    }),
  ).toBeVisible();

  await page.getByRole("button", { name: params.role === "company" ? /empresa/i : /candidato/i }).click();
  await page.getByPlaceholder("tu@email.com").fill(params.email);
  await page.getByRole("button", { name: /continuar|enviar código/i }).click();

  await completeOtpStep(page, testInfo, {
    otp: params.otp,
    actorLabel: params.role,
  });
}

export async function loginWithOtp(
  page: Page,
  testInfo: TestInfo,
  params: {
    email: string;
    otp?: string;
    next?: string;
    mode?: "company" | "candidate";
    actorLabel?: string;
  },
) {
  const url = new URL("/login", "http://localhost");
  if (params.next) url.searchParams.set("next", params.next);
  if (params.mode) url.searchParams.set("mode", params.mode);

  await page.goto(url.pathname + url.search);
  await expect(page.getByRole("heading", { name: /accede a verijob/i })).toBeVisible();

  await page.getByPlaceholder("tu@email.com").fill(params.email);

  await submitLoginAndWaitForNextStep(page);

  if (await page.getByPlaceholder("123456").isVisible().catch(() => false)) {
    await completeOtpStep(page, testInfo, {
      otp: params.otp,
      actorLabel: params.actorLabel || params.mode || "login",
    });
  }
}

export async function ensurePath(page: Page, pathname: string | RegExp) {
  await expect
    .poll(() => page.url(), {
      timeout: 20000,
      message: `Esperando navegación a ${String(pathname)}`,
    })
    .toMatch(pathname instanceof RegExp ? pathname : new RegExp(pathname));
}

export async function ensureAuthenticatedActor(
  page: Page,
  testInfo: TestInfo,
  actorLabel: PrivateActorLabel,
  options?: {
    next?: string;
    expectedPath?: string | RegExp;
  },
) {
  const config = actorConfig(actorLabel);

  const next =
    options?.next ||
    (actorLabel === "candidate"
      ? "/candidate/overview"
      : actorLabel === "company"
        ? "/company"
        : "/owner/overview");

  const expectedPath =
    options?.expectedPath ||
    (actorLabel === "candidate"
      ? /\/candidate\/overview|\/onboarding(\/)?$/
      : actorLabel === "company"
        ? /\/company|\/onboarding\/company/
        : /\/owner(\/overview)?/);

  await page.goto(next);

  if (!/\/login|\/signup/i.test(page.url()) && isAuthenticatedUrl(page.url(), actorLabel)) {
    await persistStorageState(page.context(), config.storageStatePath);
    return "reused";
  }

  if (actorLabel !== "owner" && config.authMode === "signup") {
    await signupWithOtp(page, testInfo, {
      role: actorLabel,
      email: config.email,
      otp: config.otp,
    });
  } else {
    await loginWithOtp(page, testInfo, {
      email: config.email,
      otp: config.otp,
      mode: actorLabel === "owner" ? undefined : actorLabel,
      actorLabel,
      next,
    });
  }

  if (/\/login/i.test(page.url())) {
    await page.goto(next);
  }

  await ensurePath(page, expectedPath);
  await persistStorageState(page.context(), config.storageStatePath);
  return "authenticated";
}
