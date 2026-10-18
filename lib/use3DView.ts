"use client";

import { useCallback, useEffect, useState } from "react";

// Experimental 3D dashboard view toggle. Deliberately isolated from the rest
// of the theme system (own storage key, own hook) so the whole feature —
// this file, components/Dashboard3DView.tsx, the "3D VIEW" block in
// app/globals.css, and the one toggle button + one wrapper line in
// app/page.tsx — can be deleted cleanly if it doesn't earn its keep.
export const VIEW3D_STORAGE_KEY = "kpi-3d-view";

export function use3DView() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEnabled(localStorage.getItem(VIEW3D_STORAGE_KEY) === "1");
    } catch {
      // best-effort only — a private window or blocked storage just means
      // the view starts flat every time, which is a fine default
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

  return { enabled, toggle };
}
