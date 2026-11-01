/**
 * Screenshot + GIF-frame capture for the README.
 *
 *   node tools/shot.mjs            # captures docs/images/*.png and ./.frames/*.png
 *
 * Requires the backend on :8000 and the frontend on :3000, plus a local Chrome
 * (playwright-core is used without downloading a browser).
 */
import { chromium } from "playwright-core";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.WEB_BASE ?? "http://localhost:3000";
const API = process.env.API_BASE ?? "http://127.0.0.1:8000/api";
const OUT = path.resolve("docs/images");
const FRAMES = path.resolve(".frames");

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  locale: "zh-CN",
  timezoneId: "Asia/Shanghai",
});
const page = await context.newPage();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shot(name, { clip } = {}) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), clip });
  console.log("shot", name);
}

async function signIn() {
  const auth = await page.evaluate(async (api) => {
    const res = await fetch(`${api}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "demo@mediflow.ai", password: "demo1234" }),
    });
    return res.ok ? res.json() : null;
  }, API);
  if (!auth) throw new Error("login failed — is the backend running?");
  await page.evaluate((payload) => {
    localStorage.setItem("mediflow.token", payload.access_token);
    localStorage.setItem("mediflow.user", JSON.stringify(payload.user));
  }, auth);
  return auth;
}

async function send(text) {
  const box = page.locator("textarea[aria-label='输入问诊内容']");
  await box.click();
  await box.fill(text);
  await box.press("Enter");
}

async function waitIdle(ms = 1200) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await sleep(ms);
}

await rm(FRAMES, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
await mkdir(FRAMES, { recursive: true });

// ---------------------------------------------------------------- login page
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await shot("login");

// ---------------------------------------------------------------- workspace
await signIn();

// Clean slate: delete existing sessions so the empty state is real.
await page.evaluate(async (api) => {
  const token = localStorage.getItem("mediflow.token");
  const res = await fetch(`${api}/sessions`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return;
  const { sessions } = await res.json();
  await Promise.all(
    sessions.map((s) =>
      fetch(`${api}/sessions/${s.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }),
    ),
  );
}, API);

await page.goto(`${BASE}/consult`, { waitUntil: "networkidle" });
await waitIdle(900);
await shot("consult-empty");

// ---------------------------------------------------------------- turn 1: triage
await send("最近总是头晕，早上起来尤其明显，站起来会眼前发黑");
await sleep(900);
await shot("consult-streaming"); // mid-stream: timeline + caret
await sleep(6000);
await waitIdle(800);
await shot("consult-triage");

// ---------------------------------------------------------------- turn 2: advice
const frameCount = 10;
await send("这种情况已经两周了，需要去医院吗？平时血压 118/76");
for (let i = 0; i < frameCount; i += 1) {
  await page.screenshot({ path: path.join(FRAMES, `frame-${String(i).padStart(2, "0")}.png`) });
  await sleep(700);
}
await sleep(2500);
await waitIdle(1200);
await shot("consult-advice");

// ---------------------------------------------------------------- turn 3: emergency
const newSession = page.getByRole("button", { name: /新建问诊/ }).first();
await newSession.click().catch(() => {});
await waitIdle(600);
await send("我爸胸口压着疼，满头大汗，已经十几分钟了");
await sleep(4000);
await waitIdle(600);
await shot("consult-emergency");

// ---------------------------------------------------------------- reports
await page.goto(`${BASE}/reports`, { waitUntil: "networkidle" });
await waitIdle(1200);
await shot("reports");

// ---------------------------------------------------------------- insights
await page.goto(`${BASE}/insights`, { waitUntil: "networkidle" });
await waitIdle(1200);
await shot("insights");

// ---------------------------------------------------------------- mobile
const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  locale: "zh-CN",
  isMobile: true,
  hasTouch: true,
});
const mobilePage = await mobile.newPage();
await mobilePage.goto(`${BASE}/consult`, { waitUntil: "networkidle" });
await mobilePage.evaluate(
  ({ token, user }) => {
    localStorage.setItem("mediflow.token", token);
    localStorage.setItem("mediflow.user", user);
  },
  {
    token: await page.evaluate(() => localStorage.getItem("mediflow.token")),
    user: await page.evaluate(() => localStorage.getItem("mediflow.user")),
  },
);
await mobilePage.reload({ waitUntil: "networkidle" });
await sleep(1200);
await mobilePage.screenshot({ path: path.join(OUT, "consult-mobile.png") });
console.log("shot consult-mobile");
await mobile.close();

await browser.close();
console.log("done →", OUT);
