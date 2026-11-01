"use client";

import { useId, useState } from "react";
import { formatDateShort, formatNumber } from "@/lib/format";

type Datum = { date: string; runs: number };

function niceStep(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const exponent = Math.floor(Math.log10(value));
  const fraction = value / 10 ** exponent;
  const nice =
    fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return nice * 10 ** exponent;
}

export function BarChart({
  data,
  height = 250,
}: {
  data: Datum[];
  height?: number;
}) {
  const gradientId = `bar-grad-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const titleId = `bar-title-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [hovered, setHovered] = useState<number | null>(null);

  const width = 760;
  const padding = { top: 24, right: 12, bottom: 30, left: 40 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const values = data.map((item) => item.runs);
  const rawMax = Math.max(...values, 1);
  const step = niceStep(rawMax / 4);
  const maxY = Math.max(step * 4, rawMax);
  const groupWidth = data.length > 0 ? plotWidth / data.length : plotWidth;
  const barWidth = Math.min(26, Math.max(8, groupWidth * 0.48));

  const yFor = (value: number) =>
    padding.top + plotHeight - (value / maxY) * plotHeight;

  const ticks = [0, 1, 2, 3, 4].map((index) => {
    const value = (maxY / 4) * index;
    return { value, y: yFor(value) };
  });

  const hoveredDatum = hovered != null ? data[hovered] : null;
  const hoveredBarX =
    hovered != null
      ? padding.left + groupWidth * hovered + (groupWidth - barWidth) / 2
      : 0;
  const tooltipWidth = 78;
  const tooltipX = Math.min(
    Math.max(hoveredBarX + barWidth / 2 - tooltipWidth / 2, 4),
    width - tooltipWidth - 4,
  );
  const tooltipY =
    hovered != null
      ? Math.max(4, yFor(data[hovered].runs) - 48)
      : 0;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full"
      role="img"
      aria-labelledby={titleId}
      onMouseLeave={() => setHovered(null)}
    >
      <title id={titleId}>
        每日问诊量柱状图，共 {data.length} 天，最高{" "}
        {formatNumber(Math.max(...values, 0))} 次
      </title>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0891b2" />
          <stop offset="100%" stopColor="#67e8f9" stopOpacity="0.75" />
        </linearGradient>
      </defs>

      {ticks.map((tick) => (
        <g key={tick.value}>
          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={tick.y}
            y2={tick.y}
            stroke="#eef2f6"
            strokeWidth={1}
          />
          <text
            x={padding.left - 8}
            y={tick.y + 3}
            textAnchor="end"
            fontSize="8.5"
            fill="#94a3b8"
          >
            {formatNumber(tick.value)}
          </text>
        </g>
      ))}

      {data.map((item, index) => {
        const x = padding.left + groupWidth * index + (groupWidth - barWidth) / 2;
        const barHeight = Math.max(2, (item.runs / maxY) * plotHeight);
        const y = padding.top + plotHeight - barHeight;
        const isHovered = hovered === index;
        return (
          <g key={item.date}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx={4}
              fill={isHovered ? "#0b5d73" : `url(#${gradientId})`}
              className="animate-fade-in transition-[fill] duration-150"
              style={{ animationDelay: `${index * 28}ms` }}
            />
            <rect
              x={padding.left + groupWidth * index}
              y={padding.top}
              width={groupWidth}
              height={plotHeight}
              fill="transparent"
              style={{ pointerEvents: "all" }}
              onMouseEnter={() => setHovered(index)}
              aria-hidden
            >
              <title>
                {formatDateShort(`${item.date}T00:00:00`)}：{item.runs} 次
              </title>
            </rect>
            {index % 2 === 0 || index === data.length - 1 ? (
              <text
                x={padding.left + groupWidth * index + groupWidth / 2}
                y={height - 10}
                textAnchor="middle"
                fontSize="8.5"
                fill={index === data.length - 1 ? "#475569" : "#94a3b8"}
                fontWeight={index === data.length - 1 ? 600 : 400}
              >
                {formatDateShort(`${item.date}T00:00:00`)}
              </text>
            ) : null}
          </g>
        );
      })}

      {hoveredDatum ? (
        <g pointerEvents="none">
          <rect
            x={tooltipX}
            y={tooltipY}
            width={tooltipWidth}
            height={36}
            rx={8}
            fill="#0f172a"
            opacity={0.94}
          />
          <text
            x={tooltipX + tooltipWidth / 2}
            y={tooltipY + 13}
            textAnchor="middle"
            fontSize="8"
            fill="#94a3b8"
          >
            {formatDateShort(`${hoveredDatum.date}T00:00:00`)}
          </text>
          <text
            x={tooltipX + tooltipWidth / 2}
            y={tooltipY + 27}
            textAnchor="middle"
            fontSize="10.5"
            fontWeight={600}
            fill="#ffffff"
          >
            {hoveredDatum.runs} 次问诊
          </text>
        </g>
      ) : null}
    </svg>
  );
}
