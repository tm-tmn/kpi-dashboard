"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

// Experimental 3D view for charts only (bar charts / trend line charts) —
// NOT the whole page. Scoped on purpose after feedback that an earlier
// version tilted the entire dashboard; see components/Chart3DCard.tsx,
// which this hook drives. A single shared rotation is dragged from any
// chart so every chart tilts together like one consistent camera angle,
// rather than each chart having its own independent (and confusing) tilt.
export const VIEW3D_STORAGE_KEY = "kpi-3d-charts";

const ROT_X_LIMIT = 18;
const ROT_Y_LIMIT = 28;
const DEFAULT_ROT_X = -8;
const DEFAULT_ROT_Y = 14;

export function use3DView() {
  const [enabled, setEnabled] = useState(false);
  const [rotX, setRotX] = useState(DEFAULT_ROT_X);
  const [rotY, setRotYState] = useState(DEFAULT_ROT_Y);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number; rotX: number; rotY: number } | null>(null);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEnabled(localStorage.getItem(VIEW3D_STORAGE_KEY) === "1");
    } catch {
      // best-effort only
    }
  }, []);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(VIEW3D_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      dragStart.current = { x: e.clientX, y: e.clientY, rotX, rotY };
      setDragging(true);
      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    [rotX, rotY]
  );

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setRotYState(Math.max(-ROT_Y_LIMIT, Math.min(ROT_Y_LIMIT, dragStart.current.rotY + dx * 0.2)));
    setRotX(Math.max(-ROT_X_LIMIT, Math.min(ROT_X_LIMIT, dragStart.current.rotX - dy * 0.2)));
  }, []);

  const endDrag = useCallback(() => {
    dragStart.current = null;
    setDragging(false);
  }, []);

  const reset = useCallback(() => {
    setRotX(DEFAULT_ROT_X);
    setRotYState(DEFAULT_ROT_Y);
  }, []);

  const setRotY = useCallback((v: number) => {
    setRotYState(Math.max(-ROT_Y_LIMIT, Math.min(ROT_Y_LIMIT, v)));
  }, []);

  return {
    enabled,
    toggle,
    rotX,
    rotY,
    setRotY,
    dragging,
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onPointerLeave: endDrag,
    onPointerCancel: endDrag,
    reset,
  };
}
