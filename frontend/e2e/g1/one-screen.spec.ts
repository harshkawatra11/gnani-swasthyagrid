import { expect, test } from "@playwright/test";

// Plan 7: District Comparison and Dispatch must fit one screen with no page scroll
// at lg+ widths. Fleet may scroll, but only down to the end of the Driver cam.
const VIEWPORTS = [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

const NO_SCROLL_ROUTES = ["/districts", "/supply", "/beds", "/doctors", "/diagnostics", "/footfall"];

for (const viewport of VIEWPORTS) {
  test.describe(`one-screen layouts at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    for (const route of NO_SCROLL_ROUTES) {
      test(`${route} has no page scroll`, async ({ page }) => {
        await page.goto(route, { waitUntil: "load" });
        await page.waitForLoadState("networkidle").catch(() => undefined);
        await page.waitForTimeout(1000);
        const overflow = await page.evaluate(() => {
          const el = document.scrollingElement;
          return el ? el.scrollHeight - window.innerHeight : 0;
        });
        expect(overflow, `${route} overflows by ${overflow}px at ${viewport.width}x${viewport.height}`).toBeLessThanOrEqual(1);
      });
    }
  });
}

test.describe("Fleet scroll ends at the Driver cam", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("nothing meaningful sits more than 48px below the Driver cam", async ({ page }) => {
    await page.goto("/supply/fleet", { waitUntil: "load" });
    await page.waitForLoadState("networkidle").catch(() => undefined);
    const cam = page.getByTestId("driver-cam");
    await expect(cam).toBeVisible({ timeout: 20_000 });
    const gap = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="driver-cam"]');
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      const pageBottom = document.scrollingElement?.scrollHeight ?? 0;
      return pageBottom - (window.scrollY + rect.bottom);
    });
    expect(gap, `Fleet page content extends ${gap}px past the Driver cam`).toBeLessThanOrEqual(48);
  });
});
