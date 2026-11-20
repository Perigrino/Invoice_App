import { test, expect } from "@playwright/test";

/**
 * The preview used to be `<object type="application/pdf">`, which needs the
 * browser's PDF viewer plugin. Chromium builds that do not ship it — Electron
 * and several mobile browsers — rendered an empty box, so the preview now
 * draws the same bytes onto canvases. This fails if it ever goes back to
 * something the page cannot paint itself.
 */
test("the editor draws its PDF preview on a canvas", async ({ page }) => {
  await page.goto("/invoices/new");

  const canvas = page.locator("[data-pdf-pages] canvas").first();
  await expect(canvas).toBeVisible({ timeout: 30_000 });

  await expect
    .poll(
      () =>
        canvas.evaluate((element) => {
          const c = element as HTMLCanvasElement;
          const context = c.getContext("2d");
          if (!context) return 0;
          const { data } = context.getImageData(0, 0, c.width, Math.min(400, c.height));
          let dark = 0;
          for (let i = 0; i < data.length; i += 4) {
            if (data[i] < 240 || data[i + 1] < 240 || data[i + 2] < 240) dark += 1;
          }
          return dark;
        }),
      { timeout: 20_000 }
    )
    .toBeGreaterThan(500);
});
