import { expect, type Page, type TestInfo } from "@playwright/test";

export function installPageDiagnostics(page: Page, testInfo: TestInfo, label: string) {
  const failures: string[] = [];
  const pageErrors: string[] = [];

  page.on("pageerror", (error) => {
    pageErrors.push(String(error?.message || error));
  });

  page.on("requestfailed", (request) => {
    failures.push(`requestfailed ${request.method()} ${request.url()} :: ${request.failure()?.errorText || "unknown"}`);
  });

  page.on("response", (response) => {
    if (response.status() >= 500) {
      failures.push(`response ${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });

  return {
    async assertHealthy() {
      if (pageErrors.length > 0) {
        await testInfo.attach(`${label}-page-errors.txt`, {
          body: pageErrors.join("\n"),
          contentType: "text/plain",
        });
      }
      if (failures.length > 0) {
        await testInfo.attach(`${label}-network-failures.txt`, {
          body: failures.join("\n"),
          contentType: "text/plain",
        });
      }

      expect(pageErrors, `${label}: no debe haber errores JS no controlados`).toEqual([]);
      expect(
        failures.filter((entry) => !entry.includes("/_next/webpack-hmr")),
        `${label}: no debe haber 500 silenciosos ni request failures`,
      ).toEqual([]);
    },
  };
}

export async function expectNoBlankScreen(page: Page, label: string) {
  await expect(page.locator("body"), `${label}: body visible`).toBeVisible();
  const text = await page.locator("body").innerText();
  expect(text.trim().length, `${label}: la pantalla no puede quedar en blanco`).toBeGreaterThan(20);
}
