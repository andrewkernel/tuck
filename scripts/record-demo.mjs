import { mkdir, rename, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const outputDirectory = resolve("assets", "demo");
await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
  recordVideo: { dir: outputDirectory, size: { width: 1280, height: 720 } },
});
const page = await context.newPage();
await page.goto(pathToFileURL(resolve("demo", "tabshelf-demo.html")).href);
await page.waitForTimeout(17_000);
const video = page.video();
await context.close();
await browser.close();
const recording = await video.path();
const destination = resolve(outputDirectory, "tabshelf-demo.webm");
await rm(destination, { force: true });
if (recording !== destination) await rename(recording, destination);
console.log(destination);
