import { expect, type Browser, type BrowserContext, type Page, type TestInfo } from "@playwright/test";

export type SmokeActorContext = {
  context: BrowserContext;
  page: Page;
  close: () => Promise<void>;
};

async function createActorContext(browser: Browser, actorLabel: "candidate" | "company"): Promise<SmokeActorContext> {
  console.log(`[smoke] Running ${actorLabel} flow in isolated context`);
  const context = await browser.newContext();
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

async function fillOtp(page: Page, otp: string) {
  await page.getByPlaceholder("123456").fill(otp);
  await page.getByRole("button", { name: /verificar código/i }).click();
}

export async function completeOtpStep(page: Page, testInfo: TestInfo, params: { otp?: string; actorLabel: string }) {
  await expect(page.getByText(/introduce el código recibido/i).or(page.getByText(/introduce el código/i))).toBeVisible();

  if (params.otp) {
    await fillOtp(page, params.otp);
    return;
  }

  if (testInfo.project.use.headless) {
    throw new Error(`Falta OTP para ${params.actorLabel}. Ejecuta el smoke con SMOKE_${params.actorLabel.toUpperCase()}_OTP o en modo headed para completar el paso manual.`);
  }

  console.log(`[smoke] OTP manual requerido para ${params.actorLabel}. Completa el código en el navegador y reanuda la ejecución.`);
  await page.pause();
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
  await expect(page.getByRole("heading", { name: params.role === "company" ? /activar cuenta de empresa/i : /crear cuenta en verijob/i })).toBeVisible();

  await page.getByRole("button", { name: params.role === "company" ? /empresa/i : /candidato/i }).click();
  await page.getByPlaceholder("tu@email.com").fill(params.email);
  await page.getByRole("button", { name: /enviar código/i }).click();
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
  },
) {
  const url = new URL("/login", "http://localhost");
  if (params.next) url.searchParams.set("next", params.next);
  if (params.mode) url.searchParams.set("mode", params.mode);

  await page.goto(url.pathname + url.search);
  await expect(page.getByRole("heading", { name: /accede a verijob/i })).toBeVisible();
  await page.getByPlaceholder("tu@email.com").fill(params.email);
  await page.getByRole("button", { name: /enviar código/i }).click();
  await completeOtpStep(page, testInfo, {
    otp: params.otp,
    actorLabel: params.mode || "login",
  });
}

export async function ensurePath(page: Page, pathname: string | RegExp) {
  await expect
    .poll(() => page.url(), {
      timeout: 20_000,
      message: `Esperando navegación a ${String(pathname)}`,
    })
    .toMatch(pathname instanceof RegExp ? pathname : new RegExp(pathname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}
