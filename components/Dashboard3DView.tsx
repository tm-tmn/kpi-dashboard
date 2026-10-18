"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { RotateCcw, Droplet } from "lucide-react";

const ROT_X_LIMIT = 18;

/** Experimental 3D view for the dashboard (see lib/use3DView.ts for the
 * on/off toggle this wraps around). The whole dashboard tilts as one plane
 * in a perspective scene — drag with the mouse, or use the slider — and
 * flips over to a simple styled back face past ±90° so there's always
 * something to look at while spinning almost the full 360°. Self-contained:
 * removing this file + its "3D VIEW" CSS block in app/globals.css + the one
 * toggle button and wrapper line in app/page.tsx fully removes the feature. */
export function Dashboard3DView({ children }: { children: ReactNode }) {
  const [rotX, setRotX] = useState(0);
  const [rotY, setRotY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number; rotX: number; rotY: number } | null>(null);

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    // Clicks on real controls (buttons, links, selects, inputs anywhere in
    // the dashboard) pass straight through untouched — only a drag that
    // starts on inert background/whitespace rotates the view.
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, select, textarea, label, option")) return;
    dragStart.current = { x: e.clientX, y: e.clientY, rotX, rotY };
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setRotY(dragStart.current.rotY + dx * 0.4);
    setRotX(Math.max(-ROT_X_LIMIT, Math.min(ROT_X_LIMIT, dragStart.current.rotX - dy * 0.3)));
  }
  function endDrag() {
    dragStart.current = null;
    setDragging(false);
  }
  function reset() {
    setRotX(0);
    setRotY(0);
  }

  return (
    <div className="view3d-stage">
      <div
        className={`view3d-card ${dragging ? "is-dragging" : ""}`}
        style={{ transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onPointerCancel={endDrag}
      >
        <div className="view3d-face view3d-face-front">{children}</div>
        <div className="view3d-face view3d-face-back" aria-hidden="true">
          <div className="view3d-back-content">
            <Droplet size={40} strokeWidth={1.6} className="view3d-back-drop" />
            <p className="view3d-back-title">หน่วยเจาะเลือด เก็บสิ่งส่งตรวจ และ POCT</p>
            <p className="view3d-back-sub">โรงพยาบาลศรีนครินทร์</p>
          </div>
        </div>
      </div>

      <div className="view3d-controls glass-panel">
        <span className="view3d-controls-label">หมุนมุมมอง</span>
        <input
          type="range"
          min={-180}
          max={180}
          value={Math.round(((rotY % 360) + 540) % 360) - 180}
          onChange={(e) => setRotY(Number(e.target.value))}
          className="range range-xs"
          aria-label="หมุนมุมมอง 3D แนวนอน"
        />
        <button onClick={reset} className="btn btn-ghost btn-xs gap-1 text-base-content/60" title="รีเซ็ตมุมมอง">
          <RotateCcw size={12} />
          รีเซ็ต
        </button>
      </div>
    </div>
  );
}
