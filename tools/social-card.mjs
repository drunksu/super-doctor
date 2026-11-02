/**
 * Render the GitHub social preview card (1280×640).
 *
 *   node tools/social-card.mjs
 *
 * Upload docs/images/social-preview.png in the repository settings → Social preview.
 */
import { chromium } from "playwright-core";
import path from "node:path";
import { readFile } from "node:fs/promises";

const OUT = path.resolve("docs/images/social-preview.png");

const shot = `data:image/png;base64,${(await readFile(path.resolve("docs/images/consult-advice.png"))).toString("base64")}`;

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1280px; height: 640px; overflow: hidden;
    font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    background:
      radial-gradient(900px 420px at 82% -10%, #cffafe 0%, rgba(207,250,254,0) 60%),
      radial-gradient(700px 380px at 0% 110%, #ccfbf1 0%, rgba(204,251,241,0) 55%),
      #ffffff;
    color: #0f172a; display: flex; align-items: center;
  }
  .wrap { display: flex; width: 100%; padding: 0 64px; gap: 48px; align-items: center; }
  .left { width: 620px; }
  .brand { display: flex; align-items: center; gap: 16px; }
  .mark {
    width: 64px; height: 64px; border-radius: 16px;
    background: linear-gradient(140deg, #0e7490 0%, #0891b2 58%, #0d9488 100%);
    display: grid; place-items: center;
  }
  h1 { font-size: 46px; letter-spacing: -1.4px; line-height: 1.08; }
  .sub { margin-top: 6px; font-size: 17px; color: #64748b; letter-spacing: .2px; }
  p.lead { margin-top: 22px; font-size: 19px; line-height: 1.62; color: #334155; }
  .chips { margin-top: 26px; display: flex; flex-wrap: wrap; gap: 10px; }
  .chip {
    font-size: 14px; color: #0e7490; background: #ecfeff;
    border: 1px solid #bae6fd; border-radius: 999px; padding: 6px 14px;
  }
  .meta { margin-top: 26px; display: flex; gap: 26px; font-size: 14px; color: #64748b; }
  .meta b { color: #0f172a; font-weight: 600; }
  .shot {
    width: 520px; border-radius: 18px; overflow: hidden;
    box-shadow: 0 28px 60px -26px rgba(15, 23, 42, .45), 0 0 0 1px rgba(15,23,42,.06);
    transform: perspective(1400px) rotateY(-7deg) rotateX(2deg);
  }
  .shot img { width: 100%; display: block; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="left">
      <div class="brand">
        <span class="mark">
          <svg width="34" height="34" viewBox="0 0 64 64"><path d="M13 34h9.5l4.2-12.5L35 49l4.8-15 3.7 6H51"
            fill="none" stroke="#fff" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
        <div>
          <h1>Super-Doctor</h1>
          <div class="sub">分诊优先的智能问诊多智能体系统</div>
        </div>
      </div>
      <p class="lead">红旗症状由确定性规则在任何模型调用之前拦下；其余问题走「路由 → 检索 → 作答」，每条结论都能追到指南片段。</p>
      <div class="chips">
        <span class="chip">19 条红旗规则</span>
        <span class="chip">急诊 0 ms</span>
        <span class="chip">引用可校验</span>
        <span class="chip">句级护栏</span>
      </div>
      <div class="meta">
        <span><b>62</b> tests</span>
        <span><b>70</b> guideline chunks</span>
        <span><b>0</b> model calls on emergencies</span>
      </div>
    </div>
    <div class="shot"><img src="${shot}" /></div>
  </div>
</body>
</html>`;

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 640 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: "networkidle" });
await page.screenshot({ path: OUT });
await browser.close();
console.log("wrote", OUT);
