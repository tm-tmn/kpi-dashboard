"use client";

import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";

type DragHandlers = {
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
  onPointerCancel: () => void;
};

/** Wraps ONE chart's plot area (a <ResponsiveContainer>...</ResponsiveContainer>,
 * nothing else) in a perspective tilt — gives bar/line/area charts a 3D look
 * without touching anything that isn't a chart (KPI number tiles, tables,
 * entry forms stay flat). All chart instances on the page share one
 * rotation (see lib/use3DView.ts), so dragging any one of them tilts every
 * chart together like a single consistent camera angle. Renders children
 * untouched when disabled, so it's a no-op wrapper the rest of the time. */
export function Chart3DCard({
  enabled, rotX, rotY, dragging, onPointerDown, onPointerMove, onPointerUp, onPointerLeave, onPointerCancel, children,
}: DragHandlers & { enabled: boolean; rotX: number; rotY: number; dragging: boolean; children: ReactNode }) {
  if (!enabled) return <>{children}</>;
  return (
    <div className="chart3d-stage">
      <div
        className={`chart3d-plane ${dragging ? "is-dragging" : ""}`}
        style={{ transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        onPointerCancel={onPointerCancel}
      >
        {children}
      </div>
    </div>
  );
}
