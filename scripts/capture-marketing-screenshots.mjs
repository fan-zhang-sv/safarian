#!/usr/bin/env node

import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const profilePath = await mkdtemp(join(tmpdir(), "safarian-marketing-"));
const debuggingPort = 9234;
const pageUrl = `file://${join(root, "newtab.html")}`;
const themes = [
  { name: "classic", appearance: "light", filename: "safarian-theme-classic-1280x800.png" },
  { name: "emerald", appearance: "light", filename: "safarian-theme-emerald-1280x800.png" },
  { name: "twilight", appearance: "dark", filename: "safarian-theme-twilight-dark-1280x800.png" }
];

const chrome = spawn(chromePath, [
  "--headless=new",
  "--disable-background-networking",
  "--disable-component-update",
  "--disable-default-apps",
  "--disable-extensions",
  "--hide-scrollbars",
  "--no-default-browser-check",
  "--no-first-run",
  `--remote-debugging-port=${debuggingPort}`,
  `--user-data-dir=${profilePath}`,
  "--window-size=1600,1000",
  pageUrl
], { stdio: "ignore" });

try {
  const target = await waitForPageTarget();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolveSocket, rejectSocket) => {
    socket.addEventListener("open", resolveSocket, { once: true });
    socket.addEventListener("error", rejectSocket, { once: true });
  });
  const send = createCdpSender(socket);

  await send("Emulation.setDeviceMetricsOverride", {
    width: 1600,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false
  });
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }]
  });
  // Let the normal preview bootstrap settle before replacing it with the
  // deterministic marketing fixture.
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 1800));

  for (const theme of themes) {
    await renderMarketingState(send, theme);
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 1200));
    const capture = await send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
      fromSurface: true
    });
    const outputPath = join(root, "store-assets", theme.filename);
    await writeFile(outputPath, Buffer.from(capture.data, "base64"));
    execFileSync("sips", ["-z", "800", "1280", outputPath], { stdio: "ignore" });
    await writeFile(join(root, "docs", theme.filename), await readFile(outputPath));
  }

  await writeFile(
    join(root, "store-assets", "safarian-screenshot-1280x800.png"),
    await readFile(join(root, "store-assets", themes[0].filename))
  );
  await writeFile(
    join(root, "docs", "safarian-screenshot.png"),
    await readFile(join(root, "store-assets", themes[0].filename))
  );
  await writeFile(
    join(root, "store-assets", "safarian-screenshot-640x400.png"),
    await readFile(join(root, "store-assets", themes[0].filename))
  );
  execFileSync("sips", [
    "-z", "400", "640",
    join(root, "store-assets", "safarian-screenshot-640x400.png")
  ], { stdio: "ignore" });

  socket.close();
} finally {
  const exited = new Promise((resolveExit) => chrome.once("exit", resolveExit));
  chrome.kill("SIGTERM");
  await Promise.race([
    exited,
    new Promise((resolveDelay) => setTimeout(resolveDelay, 1000))
  ]);
  if (chrome.exitCode === null) {
    chrome.kill("SIGKILL");
    await exited;
  }
  await rm(profilePath, { recursive: true, force: true });
}

async function waitForPageTarget() {
  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${debuggingPort}/json`);
      const targets = await response.json();
      const page = targets.find((target) => target.type === "page" && target.url === pageUrl);
      if (page) return page;
    } catch {
      // Chrome is still starting.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 120));
  }
  throw new Error("Timed out waiting for the Safarian preview page");
}

function createCdpSender(socket) {
  let nextId = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolveRequest, rejectRequest } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) rejectRequest(new Error(message.error.message));
    else resolveRequest(message.result);
  });
  return (method, params = {}) => new Promise((resolveRequest, rejectRequest) => {
    const id = ++nextId;
    pending.set(id, { resolveRequest, rejectRequest });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function renderMarketingState(send, theme) {
  const expression = `(() => {
    applyTheme(${JSON.stringify(theme.name)});
    applyAppearance(${JSON.stringify(theme.appearance)});
    document.body.classList.remove("has-background");
    document.querySelector(".background-layer").style.backgroundImage = "";

    const recent = [
      { sessionId: "launch-brief", title: "Q3 launch brief", url: "https://docs.google.com/document/d/launch", lastModified: Date.now() - 8 * 60 * 1000 },
      { sessionId: "launch-design", title: "Onboarding flow – Figma", url: "https://www.figma.com/design/onboarding", lastModified: Date.now() - 16 * 60 * 1000 },
      { sessionId: "launch-tasks", title: "Launch checklist – Linear", url: "https://linear.app/project/launch", lastModified: Date.now() - 24 * 60 * 1000 },
      { sessionId: "trip-flights", title: "Flights to Tokyo", url: "https://www.google.com/travel/flights", lastModified: Date.now() - 31 * 60 * 1000 },
      { sessionId: "trip-hotel", title: "Tokyo hotels", url: "https://www.booking.com/city/jp/tokyo.html", lastModified: Date.now() - 38 * 60 * 1000 },
      { sessionId: "trip-guide", title: "Japan itinerary ideas", url: "https://www.lonelyplanet.com/japan", lastModified: Date.now() - 43 * 60 * 1000 },
      { sessionId: "client-mail", title: "Re: Northstar proposal", url: "https://mail.google.com/mail/u/0/#inbox/northstar", lastModified: Date.now() - 51 * 60 * 1000 },
      { sessionId: "client-crm", title: "Northstar account", url: "https://www.salesforce.com", lastModified: Date.now() - 58 * 60 * 1000 },
      { sessionId: "client-billing", title: "Northstar invoices", url: "https://dashboard.stripe.com/invoices", lastModified: Date.now() - 64 * 60 * 1000 }
    ];
    recentItemsState = recent;
    const recentGroups = [
      { label: "Ship onboarding", items: recent.slice(0, 3).map(item => ({ item, reason: "Part of your active launch work" })) },
      { label: "Plan Tokyo trip", items: recent.slice(3, 6).map(item => ({ item, reason: "Useful for your upcoming trip" })) },
      { label: "Northstar follow-up", items: recent.slice(6, 9).map(item => ({ item, reason: "Related client follow-up" })) }
    ];
    recentDisplayMode = "smart";
    renderOrganizedRecent(document.querySelector("#recent-list"), recentGroups, recent.length, "cloud", Date.now() - 18 * 60 * 1000);

    const day = (offset) => new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10);
    renderContinueJourneyCards([
      {
        label: "Ship onboarding flow",
        items: [
          { title: "Onboarding flow – Figma", url: "https://www.figma.com/design/onboarding", visitCount: 6, visitDays: [day(0), day(1), day(2)] },
          { title: "Launch checklist – Linear", url: "https://linear.app/project/launch", visitCount: 5, visitDays: [day(0), day(1), day(3)] },
          { title: "Pull requests – GitHub", url: "https://github.com/safarian/onboarding/pulls", visitCount: 4, visitDays: [day(0), day(2), day(3)] }
        ]
      },
      {
        label: "Plan Tokyo trip",
        items: [
          { title: "Flights to Tokyo", url: "https://www.google.com/travel/flights", visitCount: 5, visitDays: [day(0), day(2), day(4)] },
          { title: "Tokyo hotels", url: "https://www.booking.com/city/jp/tokyo.html", visitCount: 4, visitDays: [day(1), day(2), day(4)] },
          { title: "Japan itinerary ideas", url: "https://www.lonelyplanet.com/japan", visitCount: 3, visitDays: [day(0), day(3), day(4)] }
        ]
      },
      {
        label: "Northstar follow-up",
        items: [
          { title: "Re: Northstar proposal", url: "https://mail.google.com/mail/u/0/#inbox/northstar", visitCount: 5, visitDays: [day(0), day(1), day(2)] },
          { title: "Northstar account", url: "https://www.salesforce.com", visitCount: 4, visitDays: [day(0), day(1), day(3)] }
        ]
      }
    ], "cloud", Date.now() - 18 * 60 * 1000);

    document.querySelector("#date-line").textContent = "Monday, August 17";
    document.querySelector("#greeting-line").textContent = "Good morning";
    document.querySelector("#customize-panel").hidden = true;
    document.querySelector("#favorite-menu").hidden = true;
    window.scrollTo(0, 0);
    return document.fonts.ready;
  })()`;
  await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
}
