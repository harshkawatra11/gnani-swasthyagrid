import { expect, test, type Page } from "@playwright/test";

const RAW_ID = /\b(district_[a-z_]+|phc_\d+|chc_[a-z0-9_]+|(?:kota|alwar|bikaner|udaipur)_(?:phc|chc)_\d+)\b/;

async function noRawIds(page: Page) {
  const text = await page.locator("main").innerText();
  expect(text).not.toMatch(RAW_ID);
}

test.describe("F2 districts", () => {
  test("comparison lab renders five identical cards and no raw ids", async ({ page }) => {
    await page.goto("/districts");
    await expect(page.getByLabel(/district card$/)).toHaveCount(5, { timeout: 20_000 });
    await expect(page.getByText("Comparison matrix")).toBeVisible();
    await noRawIds(page);
  });

  test("scope switch changes content", async ({ page }) => {
    await page.goto("/districts");
    await expect(page.getByLabel(/district card$/)).toHaveCount(5, { timeout: 20_000 });
    const before = await page.getByRole("link", { name: /Critical facilities/ }).first().innerText();
    await page.goto("/districts?d=district_kota");
    await expect(page.getByLabel("Kota district card")).toBeVisible({ timeout: 20_000 });
    await expect
      .poll(async () => page.getByRole("link", { name: /Critical facilities/ }).first().innerText(), { timeout: 20_000 })
      .not.toBe(before);
  });
});

test.describe("F2 district detail", () => {
  test("deep dive report renders with a print scorecard", async ({ page }) => {
    await page.goto("/districts/district_kota");
    await expect(page.getByRole("heading", { level: 1, name: /Kota/ })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Facility table").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /print scorecard/i })).toBeVisible();
    await noRawIds(page);
  });
});

test.describe("F2 facility profile", () => {
  test("case file renders names, not ids", async ({ page }) => {
    await page.goto("/facilities/phc_18");
    await expect(page.getByRole("heading", { level: 1, name: /Rural-14/ })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Medicine cover").first()).toBeVisible();
    await noRawIds(page);
  });
});
