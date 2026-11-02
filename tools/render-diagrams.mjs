/**
 * Render the README diagrams with mermaid, using a local Chrome via playwright-core.
 *
 *   node tools/render-diagrams.mjs
 *
 * Output: docs/images/diagram-*.png at 2x, on white, with the project's type stack.
 * Committing the PNGs keeps the README readable on GitHub without client-side mermaid.
 */
import { chromium } from "playwright-core";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OUT = path.resolve("docs/images");

const THEME = {
  theme: "base",
  themeVariables: {
    fontFamily: '"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
    fontSize: "15px",
    primaryColor: "#e8f5f7",
    primaryTextColor: "#0f172a",
    primaryBorderColor: "#0e7490",
    secondaryColor: "#f8fafc",
    secondaryTextColor: "#0f172a",
    secondaryBorderColor: "#e2e8f0",
    tertiaryColor: "#ffffff",
    tertiaryBorderColor: "#e2e8f0",
    lineColor: "#94a3b8",
    textColor: "#0f172a",
    clusterBkg: "#f8fafc",
    clusterBorder: "#e2e8f0",
    edgeLabelBackground: "#ffffff",
    actorBkg: "#e8f5f7",
    actorBorder: "#0e7490",
    actorTextColor: "#0f172a",
    signalColor: "#475569",
    signalTextColor: "#334155",
    noteBkgColor: "#fef9c3",
    noteBorderColor: "#fde047",
  },
  flowchart: { curve: "basis", padding: 14, nodeSpacing: 46, rankSpacing: 54 },
  sequence: { diagramMarginX: 18, diagramMarginY: 14, actorMargin: 62, messageMargin: 34, boxMargin: 6 },
};

const DIAGRAMS = [
  {
    id: "stages",
    width: 980,
    parts: [
      `flowchart LR
        S["① 安全筛查<br/>19 条规则 · 无模型"] --> R["② 路由<br/>规则 → 调度器"]
        R --> Q["③ 检索<br/>BM25 + TF-IDF"]
        style S fill:#fff7ed,stroke:#d97706,color:#7c2d12`,
      `flowchart LR
        A["④ 作答<br/>v4-pro 流式"] --> I["⑤ 病史抽取<br/>flash · 并行"]
        I --> G["⑥ 句级护栏<br/>发送前拦截"]
        style G fill:#ecfdf5,stroke:#059669,color:#064e3b`,
    ],
  },
  {
    id: "roles",
    width: 1050,
    code: `flowchart LR
      subgraph HUMAN["人的一侧"]
        P["患者<br/>描述不适 / 追问 / 看结论"]
      end

      subgraph ROUTER["Router 层：只做决定，不写正文"]
        SV["调度器<br/>deepseek-flash<br/>追问 · 作答 · 寒暄"]
        SF["安全审查<br/>规则引擎<br/>19 条红旗规则"]
        IN["病史抽取<br/>deepseek-flash<br/>自由文本 → 槽位"]
      end

      subgraph WORKER["Worker 层：各自一个隔离上下文"]
        TR["结构化问诊<br/>deepseek-v4-pro<br/>一次只问一个问题"]
        CL["全科顾问<br/>deepseek-v4-pro<br/>分方向 + 引用 + 就医指征"]
        RP["报告解读<br/>deepseek-v4-pro<br/>指标 → 白话 + 问医生的问题"]
      end

      P --> SF
      SF -->|"常规 / 需关注"| SV
      SV --> TR
      SV --> CL
      SV --> RP
      TR --> IN
      CL --> IN
      P -.->|"化验单"| RP
      SF ==>|"红旗命中"| EM["急救处置<br/>不进入模型链路"]
      style EM fill:#fee2e2,stroke:#dc2626,color:#7f1d1d
      style SF fill:#fff7ed,stroke:#d97706,color:#7c2d12`,
  },
  {
    id: "turn",
    width: 1000,
    code: `sequenceDiagram
      autonumber
      participant U as 用户
      participant W as Next.js
      participant P as Pipeline
      participant S as 安全规则
      participant R as 指南检索
      participant M as DeepSeek

      U->>W: 描述症状
      W->>P: POST /api/chat/stream
      P->>S: assess(text)
      alt 红旗命中
          S-->>P: urgent
          P-->>W: 急救处置（不调用模型）
      else 常规
          P->>M: RouteDecision（flash）
          P-->>W: agent 事件
          opt 需要作答
              P->>R: 混合检索 top-4
              R-->>P: 带编号的片段
              P-->>W: tool + citation 事件
          end
          P->>M: 流式作答（v4-pro）
          loop 每个完整句子
              M-->>P: delta
              P->>P: 句级护栏
              P-->>W: token 事件
          end
          P->>M: 病史抽取（并行 · flash）
          P-->>W: intake / done 事件
      end`,
  },
];

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });
await page.goto("about:blank");
await page.addScriptTag({ url: "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js" });

await mkdir(OUT, { recursive: true });
await writeFile(
  path.join(OUT, "..", ".gitignore.tmp"),
  "",
).catch(() => {});

for (const diagram of DIAGRAMS) {
  const parts = diagram.parts ?? [diagram.code];
  const svgs = [];
  for (const [index, code] of parts.entries()) {
    svgs.push(
      await page.evaluate(
        async ([markup, id, theme]) => {
          // eslint-disable-next-line no-undef
          mermaid.initialize({ startOnLoad: false, ...theme });
          // eslint-disable-next-line no-undef
          const { svg } = await mermaid.render(`m-${id}-${Math.random().toString(36).slice(2)}`, markup);
          return svg;
        },
        [code, `${diagram.id}-${index}`, THEME],
      ),
    );
  }

  await page.evaluate(
    ([markups, width]) => {
      const body = markups
        .map(
          (markup, index) =>
            (index > 0 ? `<div class="joiner">↓</div>` : "") +
            `<div class="row">${markup}</div>`,
        )
        .join("");
      document.body.innerHTML = `
        <style>
          #stage { display:inline-block; padding:22px 26px; background:#fff; box-sizing:border-box;
                   font-family:"Segoe UI","PingFang SC",sans-serif; }
          #stage .row svg { width:${width}px; max-width:${width}px; height:auto; display:block; margin:0 auto; }
          #stage .joiner { text-align:center; color:#94a3b8; font-size:20px; line-height:1.1; margin:2px 0; }
        </style>
        <div id="stage">${body}</div>`;
    },
    [svgs, diagram.width],
  );

  const stage = page.locator("#stage");
  await stage.screenshot({ path: path.join(OUT, `diagram-${diagram.id}.png`) });
  console.log("diagram", diagram.id);
}

await browser.close();
console.log("done");
