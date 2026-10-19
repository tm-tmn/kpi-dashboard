"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts";
import "echarts-gl";

type PointData = { point: string; data: Record<string, string | number | null>[] };

type Props = {
  pointsData: PointData[];
  points: readonly string[];
  stage: string;
  pointShort: (point: string) => string;
  isLight: boolean;
  height?: number;
};

/** A single 3D surface stitching all 4 จุดบริการ's TAT trend together along
 * a depth axis, instead of 4 separate 2D line charts — the "3D Surface Plot"
 * view requested as an alternative so every point's TAT can be read, and
 * compared, on one sheet. Missing months (no data entered yet) are plotted
 * as 0 so the surface stays a continuous grid; the 2D toggle next to it is
 * still the place to check an exact value, since a 0 here can mean either
 * "actually zero" or "not entered yet". */
export function TatSurface3D({ pointsData, points, stage, pointShort, isLight, height = 440 }: Props) {
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
    const months = pointsData[0]?.data.map((d) => String(d.month)) ?? [];
    const axisColor = isLight ? "#64748B" : "#8C98B8";
    const lineColor = isLight ? "rgba(15,21,36,0.2)" : "rgba(255,255,255,0.2)";

    const grid: number[][] = [];
    let maxZ = 1;
    points.forEach((point, yi) => {
      const series = pointsData.find((p) => p.point === point);
      months.forEach((_, xi) => {
        const raw = series?.data[xi]?.[stage];
        const z = typeof raw === "number" ? raw : 0;
        maxZ = Math.max(maxZ, z);
        grid.push([xi, yi, z]);
      });
    });

    chart.setOption({
      tooltip: {
        formatter: (p: { value: [number, number, number] }) => {
          const [xi, yi, z] = p.value;
          return z > 0
            ? `${pointShort(points[yi])}<br/>${months[xi]}: ${z.toFixed(1)} นาที`
            : `${pointShort(points[yi])}<br/>${months[xi]}: ไม่มีข้อมูล`;
        },
      },
      visualMap: {
        show: true,
        dimension: 2,
        min: 0,
        max: maxZ,
        inRange: { color: ["#1C7FD6", "#34D399", "#F6A75E", "#F87171"] },
        textStyle: { color: axisColor, fontSize: 10 },
        itemWidth: 12,
        itemHeight: 90,
        left: 0,
        bottom: 10,
      },
      xAxis3D: { type: "category", data: months, axisLabel: { color: axisColor, fontSize: 10 } },
      yAxis3D: { type: "category", data: points.map((p) => pointShort(p)), axisLabel: { color: axisColor, fontSize: 10 } },
      zAxis3D: { type: "value", name: "นาที", nameTextStyle: { color: axisColor }, axisLabel: { color: axisColor, fontSize: 10 } },
      grid3D: {
        boxWidth: 140,
        boxDepth: 90,
        boxHeight: 70,
        viewControl: { autoRotate: false, distance: 195, alpha: 25, beta: 25 },
        light: { main: { intensity: 1.1, shadow: false }, ambient: { intensity: 0.45 } },
        axisLine: { lineStyle: { color: lineColor } },
        splitLine: { lineStyle: { color: lineColor } },
      },
      series: [
        {
          type: "surface",
          data: grid,
          shading: "color",
          wireframe: { show: true, lineStyle: { color: lineColor, width: 1 } },
        },
      ],
    });
  }, [pointsData, points, stage, pointShort, isLight]);

  return <div ref={ref} style={{ width: "100%", height }} />;
}
