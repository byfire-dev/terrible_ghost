import { spawn } from "node:child_process";
import { chromium, devices } from "playwright";

const PORT = 8124;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function startServer() {
  const server = spawn("python3", ["-m", "http.server", String(PORT)], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  return server;
}

async function waitForServer() {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(BASE_URL);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  }
  throw new Error("release check server did not start");
}

async function smoke(label, contextOptions) {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  const page = await browser.newPage(contextOptions);
  const errors = [];
  const failed = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("requestfailed", (request) => failed.push(request.url()));

  await page.goto(`${BASE_URL}/?release=${label}`, { waitUntil: "networkidle" });
  const homeAssets = await page.evaluate(() => performance.getEntriesByType("resource")
    .map((entry) => entry.name)
    .filter((name) => name.includes("/assets/images/"))
    .map((name) => name.split("/").pop())
    .sort());

  if (label === "mobile") await page.tap("#startBtn");
  else await page.click("#startBtn");
  await page.waitForSelector("#introStartBtn", { state: "visible" });
  if (label === "mobile") await page.tap("#introStartBtn");
  else await page.click("#introStartBtn");
  await page.waitForTimeout(1200);

  const state = await page.evaluate(async () => {
    const canvas = document.querySelector("canvas");
    const ctx = canvas.getContext("2d");
    const sample = ctx.getImageData(
      Math.floor(canvas.width * 0.25),
      Math.floor(canvas.height * 0.25),
      Math.floor(canvas.width * 0.5),
      Math.floor(canvas.height * 0.5),
    ).data;
    let lit = 0;
    for (let i = 0; i < sample.length; i += 16) lit += sample[i] + sample[i + 1] + sample[i + 2];

    const registration = await navigator.serviceWorker?.ready?.catch(() => null);
    const cacheKeys = "caches" in window ? await caches.keys() : [];
    return {
      lit,
      objectiveVisible: !document.querySelector("#objectiveToast")?.classList.contains("hidden"),
      fireVisible: getComputedStyle(document.querySelector("#fireButton")).display !== "none",
      joystickVisible: getComputedStyle(document.querySelector("#joystick")).display !== "none",
      serviceWorkerReady: Boolean(registration?.active),
      cacheKeys,
    };
  });

  await browser.close();
  return { label, errors, failed, homeAssets, state };
}

function assertSmoke(result) {
  if (result.errors.length > 0) throw new Error(`${result.label} console errors: ${result.errors.join("; ")}`);
  if (result.failed.length > 0) throw new Error(`${result.label} failed requests: ${result.failed.join("; ")}`);
  if (!result.state.lit) throw new Error(`${result.label} canvas is blank`);
  if (!result.state.objectiveVisible) throw new Error(`${result.label} objective toast did not appear`);
  if (result.homeAssets.some((asset) => asset.endsWith(".png"))) throw new Error(`${result.label} loaded PNG on first screen`);
  if (!result.state.serviceWorkerReady) throw new Error(`${result.label} service worker did not become ready`);
  if (!result.state.cacheKeys.some((key) => key.startsWith("terrible-ghost-2026-05-09-1"))) {
    throw new Error(`${result.label} expected release cache was not created`);
  }
  if (result.label === "mobile" && (!result.state.fireVisible || !result.state.joystickVisible)) {
    throw new Error("mobile controls are not visible");
  }
}

const server = startServer();
try {
  await waitForServer();
  const desktop = await smoke("desktop", { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const mobile = await smoke("mobile", { ...devices["iPhone 13"] });
  assertSmoke(desktop);
  assertSmoke(mobile);
  console.log(JSON.stringify({
    desktop: {
      homeAssets: desktop.homeAssets,
      cacheKeys: desktop.state.cacheKeys,
    },
    mobile: {
      homeAssets: mobile.homeAssets,
      cacheKeys: mobile.state.cacheKeys,
    },
  }, null, 2));
} finally {
  server.kill("SIGTERM");
}
