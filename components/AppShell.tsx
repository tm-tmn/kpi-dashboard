"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Droplet, LayoutDashboard, FileSpreadsheet, Menu, LogOut } from "lucide-react";
import { useState } from "react";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";

const NAV = [
  { href: "/", label: "ภาพรวม", icon: LayoutDashboard },
  { href: "/entry", label: "กรอกข้อมูล", icon: FileSpreadsheet },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-field px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "bg-primary/15 text-primary"
                : "text-base-content/70 hover:bg-base-content/5 hover:text-base-content"
            }`}
          >
            <Icon size={18} strokeWidth={2} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-1">
      <span className="icon-badge flex h-9 w-9 items-center justify-center rounded-field bg-error/15 text-error">
        <Droplet size={18} strokeWidth={2.4} fill="currentColor" fillOpacity={0.25} />
      </span>
      <div className="leading-tight">
        <div className="text-sm font-semibold text-base-content">หน่วยเจาะเลือด</div>
        <div className="text-xs text-base-content/50">รพ.ศรีนครินทร์</div>
      </div>
    </div>
  );
}

function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }
  return (
    <button
      onClick={handleLogout}
      className={`flex items-center gap-3 rounded-field px-3 py-2.5 text-sm font-medium text-base-content/70 transition-colors hover:bg-base-content/5 hover:text-error ${className ?? ""}`}
    >
      <LogOut size={18} strokeWidth={2} />
      ออกจากระบบ
    </button>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex w-full flex-1 gap-6 px-4 py-4 sm:px-6 lg:px-10">
      {/* Desktop sidebar */}
      <aside className="sticky top-6 hidden h-[calc(100vh-3rem)] w-60 shrink-0 flex-col gap-6 lg:flex">
        <div className="glass-panel flex h-full flex-col gap-6 rounded-box p-4">
          <div className="flex items-center justify-between">
            <Brand />
          </div>
          <NavLinks />
          <div className="mt-auto flex flex-col gap-2">
            <ThemeSwitcher className="w-full justify-between" />
            <div className="rounded-field border border-base-content/8 bg-base-content/3 p-3 text-xs text-base-content/50">
              ข้อมูลซิงก์กับ Google Sheet แบบเรียลไทม์
            </div>
            <LogoutButton />
          </div>
        </div>
      </aside>

      {/* Mobile topbar */}
      <div className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-base-content/8 bg-base-100/80 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Brand />
        <div className="flex items-center gap-1.5">
          <ThemeSwitcher />
          <button
            onClick={() => setOpen(true)}
            className="btn btn-ghost btn-sm btn-circle"
            aria-label="เปิดเมนู"
          >
            <Menu size={20} />
          </button>
        </div>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="glass-panel absolute right-0 top-0 h-full w-72 p-4">
            <div className="mb-6 flex items-center justify-between">
              <Brand />
            </div>
            <NavLinks onNavigate={() => setOpen(false)} />
            <div className="mt-4 border-t border-base-content/8 pt-4">
              <ThemeSwitcher className="mb-2 w-full justify-between" />
              <LogoutButton />
            </div>
          </div>
        </div>
      )}

      <main className="min-w-0 flex-1 pt-14 lg:pt-0">{children}</main>
    </div>
  );
}
