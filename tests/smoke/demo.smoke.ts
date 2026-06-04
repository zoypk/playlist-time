import { expect, test } from "@playwright/test";

test("demo route renders the sample playlist comparison", async ({ page }) => {
  const response = await page.goto("/?demo=1", { waitUntil: "networkidle" });

  expect(response?.ok()).toBe(true);
  await expect(page).toHaveTitle(/playlist-time|YouTube Playlist Length Calculator/i);
  await expect(page.getByRole("table", { name: "Playlist comparison table" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open playlist: React patterns for production dashboards" })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open playlist: Frontend build notes under eight minutes" })
  ).toBeVisible();
  await expect(page.locator('div[aria-live="polite"]')).toHaveText("2 playlists ready. 0 with errors.");
});
