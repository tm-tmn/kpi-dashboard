"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, Loader2, AlertCircle, Droplet, Eye, EyeOff } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get("from") || "/entry";

  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Press-and-hold reveal: held down anywhere (not just released on the
  // button itself) is what releases it, so dragging off the button while
  // still holding the mouse doesn't leave the password stuck visible.
  useEffect(() => {
    if (!showPassword) return;
    const hide = () => setShowPassword(false);
    window.addEventListener("mouseup", hide);
    window.addEventListener("touchend", hide);
    return () => {
      window.removeEventListener("mouseup", hide);
      window.removeEventListener("touchend", hide);
    };
  }, [showPassword]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "เข้าสู่ระบบไม่สำเร็จ");
      router.push(from);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="glass-panel w-full max-w-sm rounded-box p-7"
      >
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-field bg-error/15 text-error">
            <Droplet size={22} strokeWidth={2.4} fill="currentColor" fillOpacity={0.25} />
          </span>
          <div>
            <h1 className="text-base font-semibold text-base-content">เข้าสู่ระบบกรอกข้อมูล</h1>
            <p className="mt-1 text-xs text-base-content/50">
              หน่วยเจาะเลือด · รพ.ศรีนครินทร์
            </p>
          </div>
        </div>

        <label className="mb-1.5 block text-xs font-medium text-base-content/50">รหัสผ่าน</label>
        <div className="relative">
          <KeyRound
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40"
          />
          <input
            autoFocus
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input input-bordered w-full bg-base-200/60 pl-9 pr-9"
            placeholder="••••••••"
          />
          <button
            type="button"
            tabIndex={-1}
            aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "กดค้างเพื่อดูรหัสผ่าน"}
            onMouseDown={(e) => {
              e.preventDefault();
              setShowPassword(true);
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              setShowPassword(true);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 select-none text-base-content/40 hover:text-base-content/70"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        {error && (
          <div role="alert" className="alert mt-4 border-0 bg-error/15 text-sm text-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !password}
          className="btn btn-primary mt-5 w-full gap-2 shadow-lg shadow-primary/20"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
          {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
