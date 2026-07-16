import { test, expect, chromium } from "@playwright/test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

test("the packed extension loads its side panel", async () => {
  const extensionPath = resolve("dist");
  const userDataDir = await mkdtemp(resolve(tmpdir(), "tabshelf-e2e-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    ignoreDefaultArgs: ["--disable-extensions"],
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  try {
    const page = await context.newPage();
    await page.goto("chrome://extensions/");
    const extension = await page.locator("extensions-manager").evaluate((manager) => {
      const itemList = manager.shadowRoot?.querySelector("extensions-item-list");
      const item = Array.from(itemList?.shadowRoot?.querySelectorAll("extensions-item") ?? []).find(
        (candidate) => candidate.shadowRoot?.textContent?.includes("TabShelf"),
      );
      if (!item) return { id: undefined, text: itemList?.shadowRoot?.textContent };
      const candidate = item as unknown as { data?: { id?: string }; extension?: { id?: string } };
      return {
        id: candidate.data?.id ?? candidate.extension?.id ?? item.getAttribute("id"),
        text: item.shadowRoot?.textContent,
      };
    });
    expect(extension?.id, extension?.text ?? undefined).toBeTruthy();
    await page.goto(`chrome-extension://${extension?.id}/sidepanel/index.html`);
    await expect(page.getByRole("main", { name: "TabShelf" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Clean now" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Turn on" })).toBeVisible();
  } finally {
    await context.close();
  }
});
