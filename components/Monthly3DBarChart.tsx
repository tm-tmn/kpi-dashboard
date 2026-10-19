"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts";
// Side-effect import — registers bar3D/surface series, *Axis3D and grid3D
// onto the echarts instance. There's no tree-shaken version of the 3D
// extension, so this pulls in the whole echarts-gl bundle; fine for an
// internal dashboard, not something to import on every page.
import "echarts-gl";

type MonthRow = Record<string, string | number>;

type Props = {
  data: MonthRow[];
  points: readonly string[];
  pointColor: (point: string) => string;
  pointShort: (point: string) => string;
  isLight: boolean;
  height?: number;
};

/** Orbitable 3D bar chart: month × จุดบริการ × count, one bar per cell.
 * Drag to rotate, scroll to zoom (echarts-gl's built-in grid3D viewControl) —
 * this is the "3D Bar Chart" / "Orbitable 3D Graph" view requested as an
 * alternative to the flat stacked bar above it. */
export function Monthly3DBarChart({ data, points, pointColor, pointShort, isLight, height = 440 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    chartRef.current = chart;
    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const months = data.map((d) => String(d.month));
    const axisColor = isLight ? "#64748B" : "#8C98B8";
    const lineColor = isLight ? "rgba(15,21,36,0.25)" : "rgba(255,255,255,0.25)";

    const series = points.map((point) => ({
      type: "bar3D" as const,
      name: pointShort(point),
      data: data.map((d, mi) => ({
        value: [mi, points.indexOf(point), Number(d[point] ?? 0)],
        itemStyle: { color: pointColor(point) },
      })),
      shading: "lambert" as const,
      bevelSize: 0.2,
      barSize: 9,
      emphasis: { itemStyle: { color: isLight ? "#1A2033" : "#FFFFFF" } },
    }));

    chart.setOption({
      tooltip: {
        formatter: (p: { value: [number, number, number] }) =>
          `${points[p.value[1]]}<br/>${months[p.value[0]]}: ${Number(p.value[2]).toLocaleString()} คน`,
      },
      legend: {
        data: points.map((p) => pointShort(p)),
        textStyle: { color: axisColor, fontSize: 11 },
        top: 0,
        right: 0,
      },
      xAxis3D: { type: "category", data: months, axisLabel: { color: axisColor, fontSize: 10 } },
      yAxis3D: { type: "category", data: points.map((p) => pointShort(p)), axisLabel: { color: axisColor, fontSize: 10 } },
      zAxis3D: { type: "value", axisLabel: { color: axisColor, fontSize: 10 } },
      grid3D: {
        boxWidth: 160,
        boxDepth: 72,
        boxHeight: 80,
        viewControl: { autoRotate: false, distance: 190, alpha: 20, beta: 30 },
        light: { main: { intensity: 1.2, shadow: false }, ambient: { intensity: 0.45 } },
        axisLine: { lineStyle: { color: lineColor } },
        splitLine: { lineStyle: { color: lineColor } },
      },
      series,
    });
  }, [data, points, pointColor, pointShort, isLight]);

  return <div ref={ref} style={{ width: "100%", height }} />;
}
